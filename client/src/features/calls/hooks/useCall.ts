import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getIceServers, type User } from '../../../api';
import { callSocket } from '../services/callSocket.service';
import { mapMediaError, WebRtcService } from '../services/webrtc.service';
import type {
  CallPhase,
  CallSession,
  CallType,
  IceServer,
} from '../types/call.types';

type UseCallOptions = {
  socket: Socket | null;
  currentUser: User;
  onIncomingCall?: (call: CallSession) => void;
};

type CallEnvelope = {
  call: CallSession;
};

type OfferEnvelope = {
  callId: string;
  sdp: RTCSessionDescriptionInit;
};

type IceEnvelope = {
  callId: string;
  candidate: RTCIceCandidateInit;
};

export function useCall({ socket, currentUser, onIncomingCall }: UseCallOptions) {
  const webrtcRef = useRef(new WebRtcService());
  const callRef = useRef<CallSession | null>(null);
  const iceServersRef = useRef<IceServer[]>([]);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const endingRef = useRef(false);

  const [phase, setPhase] = useState<CallPhase>('idle');
  const [call, setCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [error, setError] = useState('');
  const incomingHandledCallIdRef = useRef<string | null>(null);

  const debugLog = useCallback((event: string, payload?: object) => {
    if (!import.meta.env.DEV) {
      return;
    }
    console.debug('[call]', event, payload ?? {});
  }, []);

  const isTimeoutLikeError = useCallback((err: unknown) => {
    if (!(err instanceof Error)) {
      return false;
    }
    const message = err.message.toLowerCase();
    return message.includes('timed out') || message.includes('could not reach the server');
  }, []);

  const resetMedia = useCallback(() => {
    webrtcRef.current.stop();
    setLocalStream(null);
    setRemoteStream(null);
    setMicOn(true);
    setCameraOn(true);
    pendingOfferRef.current = null;
  }, []);

  const resetCall = useCallback(() => {
    endingRef.current = false;
    callRef.current = null;
    setCall(null);
    setPhase('idle');
    incomingHandledCallIdRef.current = null;
    resetMedia();
  }, [resetMedia]);

  const otherUserId = call
    ? call.callerId === currentUser.user_id
      ? call.receiverId
      : call.callerId
    : null;

  const preparePeer = useCallback(
    (activeCall: CallSession) => {
      webrtcRef.current.createPeer(iceServersRef.current, {
        onRemoteStream: setRemoteStream,
        onIceCandidate: (candidate) => {
          if (!socket) {
            return;
          }
          const receiverId =
            activeCall.callerId === currentUser.user_id
              ? activeCall.receiverId
              : activeCall.callerId;
          void callSocket.iceCandidate(socket, {
            callId: activeCall.callId,
            receiverId,
            candidate,
          });
        },
        onConnectionState: (state) => {
          if (state === 'connected') {
            setPhase('in-call');
          }
          if (state === 'failed') {
            setError('The call connection failed.');
          }
        },
      });
    },
    [currentUser.user_id, socket],
  );

  const startCall = useCallback(
    async (receiverId: number, callType: CallType) => {
      if (!socket?.connected) {
        debugLog('startCall:blocked-offline', { receiverId, callType });
        setError('You are offline. Reconnect before calling.');
        return;
      }
      if (phase !== 'idle') {
        debugLog('startCall:blocked-phase', { phase, receiverId, callType });
        return;
      }

      setError('');
      setPhase('outgoing');
      setCameraOn(callType === 'video');

      try {
        const nextCall = await callSocket.initiate(socket, {
          receiverId,
          callType,
        });
        debugLog('startCall:initiated', {
          callId: nextCall.callId,
          receiverId,
          callType,
        });
        callRef.current = nextCall;
        setCall(nextCall);

        iceServersRef.current = await getIceServers();
        const stream = await webrtcRef.current.startLocalMedia(callType === 'video');
        setLocalStream(stream);
      } catch (err) {
        debugLog('startCall:error', {
          receiverId,
          callType,
          message: err instanceof Error ? err.message : 'unknown',
        });

        if (callRef.current && isTimeoutLikeError(err)) {
          try {
            iceServersRef.current = await getIceServers();
            const stream = await webrtcRef.current.startLocalMedia(callType === 'video');
            setLocalStream(stream);
            return;
          } catch (mediaErr) {
            try {
              await callSocket.end(socket, callRef.current.callId);
            } catch {
              // Hang up locally even if signaling ack fails.
            }
            resetCall();
            const media = mapMediaError(mediaErr);
            setError(
              mediaErr instanceof DOMException || media.code !== 'unknown'
                ? media.message
                : mediaErr instanceof Error
                  ? mediaErr.message
                  : 'Could not start the call',
            );
            return;
          }
        }

        if (callRef.current) {
          try {
            await callSocket.end(socket, callRef.current.callId);
          } catch {
            // Hang up locally even if signaling ack fails.
          }
        }
        resetCall();
        const media = mapMediaError(err);
        setError(
          err instanceof DOMException || media.code !== 'unknown'
            ? media.message
            : err instanceof Error
              ? err.message
              : 'Could not start the call',
        );
      }
    },
    [debugLog, isTimeoutLikeError, phase, resetCall, socket],
  );

  const acceptCall = useCallback(async () => {
    if (!socket || !callRef.current) {
      return;
    }

    const activeCall = callRef.current;
    debugLog('acceptCall:start', {
      callId: activeCall.callId,
      callType: activeCall.callType,
    });
    setError('');
    setPhase('connecting');
    setCameraOn(activeCall.callType === 'video');

    try {
      iceServersRef.current = await getIceServers();
      const stream = await webrtcRef.current.startLocalMedia(
        activeCall.callType === 'video',
      );
      setLocalStream(stream);
      preparePeer(activeCall);
      await callSocket.accept(socket, activeCall.callId);

      if (pendingOfferRef.current) {
        const offer = pendingOfferRef.current;
        pendingOfferRef.current = null;
        const answer = await webrtcRef.current.handleOffer(offer);
        await callSocket.answer(socket, {
          callId: activeCall.callId,
          receiverId: activeCall.callerId,
          sdp: answer,
        });
      }
    } catch (err) {
      debugLog('acceptCall:error', {
        callId: activeCall.callId,
        message: err instanceof Error ? err.message : 'unknown',
      });
      resetCall();
      const media = mapMediaError(err);
      setError(
        err instanceof DOMException || media.code !== 'unknown'
          ? media.message
          : err instanceof Error
            ? err.message
            : 'Could not accept the call',
      );
    }
  }, [debugLog, preparePeer, resetCall, socket]);

  const rejectCall = useCallback(async () => {
    if (!socket || !callRef.current) {
      resetCall();
      return;
    }
    try {
      debugLog('rejectCall:start', { callId: callRef.current.callId });
      await callSocket.reject(socket, callRef.current.callId);
    } finally {
      resetCall();
    }
  }, [debugLog, resetCall, socket]);

  const endCall = useCallback(async () => {
    if (endingRef.current) {
      return;
    }
    endingRef.current = true;
    const activeCall = callRef.current;
    try {
      if (socket && activeCall) {
        debugLog('endCall:start', { callId: activeCall.callId });
        await callSocket.end(socket, activeCall.callId);
      }
    } catch {
      // Hang up locally even if the signaling ack fails.
    } finally {
      resetCall();
    }
  }, [debugLog, resetCall, socket]);

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      webrtcRef.current.setMicEnabled(!prev);
      return !prev;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      webrtcRef.current.setCameraEnabled(!prev);
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onRinging = ({ call: incoming }: CallEnvelope) => {
      debugLog('event:ringing', {
        callId: incoming.callId,
        callerId: incoming.callerId,
        receiverId: incoming.receiverId,
        status: incoming.status,
      });
      if (incoming.receiverId === currentUser.user_id) {
        if (incomingHandledCallIdRef.current === incoming.callId) {
          debugLog('event:ringing:deduped', { callId: incoming.callId });
          return;
        }
        incomingHandledCallIdRef.current = incoming.callId;
        callRef.current = incoming;
        setCall(incoming);
        setPhase('incoming');
        setError('');
        onIncomingCall?.(incoming);
        return;
      }
      if (incoming.callerId === currentUser.user_id) {
        if (callRef.current?.callId === incoming.callId) {
          return;
        }
        callRef.current = incoming;
        setCall(incoming);
      }
    };

    const onAccept = ({ call: accepted }: CallEnvelope) => {
      debugLog('event:accept', {
        callId: accepted.callId,
        callerId: accepted.callerId,
        receiverId: accepted.receiverId,
      });
      if (accepted.callId !== callRef.current?.callId) {
        return;
      }
      callRef.current = accepted;
      setCall(accepted);
      setPhase('connecting');

      if (accepted.callerId !== currentUser.user_id || !socket) {
        return;
      }

      void (async () => {
        try {
          preparePeer(accepted);
          const offer = await webrtcRef.current.createOffer();
          await callSocket.offer(socket, {
            callId: accepted.callId,
            receiverId: accepted.receiverId,
            sdp: offer,
          });
        } catch (err) {
          debugLog('offer:error', {
            message: err instanceof Error ? err.message : 'unknown',
          });
          if (!isTimeoutLikeError(err)) {
            setError(err instanceof Error ? err.message : 'Could not send call offer');
          }
        }
      })();
    };

    const onOffer = ({ callId, sdp }: OfferEnvelope) => {
      debugLog('event:offer', { callId, sdpType: sdp.type });
      if (callId !== callRef.current?.callId) {
        return;
      }
      if (!webrtcRef.current.isReady()) {
        pendingOfferRef.current = sdp;
        return;
      }
      void (async () => {
        try {
          const answer = await webrtcRef.current.handleOffer(sdp);
          const activeCall = callRef.current;
          if (!activeCall) {
            return;
          }
          await callSocket.answer(socket, {
            callId: activeCall.callId,
            receiverId: activeCall.callerId,
            sdp: answer,
          });
        } catch (err) {
          debugLog('answer:error', {
            message: err instanceof Error ? err.message : 'unknown',
          });
          if (!isTimeoutLikeError(err)) {
            setError(err instanceof Error ? err.message : 'Could not answer the call');
          }
        }
      })();
    };

    const onAnswer = ({ callId, sdp }: OfferEnvelope) => {
      debugLog('event:answer', { callId, sdpType: sdp.type });
      if (callId !== callRef.current?.callId) {
        return;
      }
      void webrtcRef.current.handleAnswer(sdp).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not connect the call');
      });
    };

    const onIce = ({ callId, candidate }: IceEnvelope) => {
      debugLog('event:ice-candidate', {
        callId,
        candidateLength: candidate.candidate?.length ?? 0,
      });
      if (callId !== callRef.current?.callId) {
        return;
      }
      void webrtcRef.current.addIceCandidate(candidate);
    };

    const onClosed = ({ call: closed }: CallEnvelope) => {
      debugLog('event:closed', {
        callId: closed.callId,
        status: closed.status,
      });
      if (closed.callId !== callRef.current?.callId) {
        return;
      }
      resetCall();
    };

    const onTimeout = ({ call: timedOut }: CallEnvelope) => {
      debugLog('event:timeout', {
        callId: timedOut.callId,
        status: timedOut.status,
      });
      if (timedOut.callId !== callRef.current?.callId) {
        return;
      }
      resetCall();
      if (timedOut.callerId === currentUser.user_id) {
        setError('The call was not answered.');
      }
    };

    const onBusy = ({ call: busy }: CallEnvelope) => {
      debugLog('event:busy', {
        callId: busy.callId,
        status: busy.status,
      });
      if (busy.callerId !== currentUser.user_id) {
        return;
      }
      resetCall();
      setError('The other user is already in a call.');
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accept', onAccept);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIce);
    socket.on('call:reject', onClosed);
    socket.on('call:end', onClosed);
    socket.on('call:timeout', onTimeout);
    socket.on('call:busy', onBusy);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accept', onAccept);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIce);
      socket.off('call:reject', onClosed);
      socket.off('call:end', onClosed);
      socket.off('call:timeout', onTimeout);
      socket.off('call:busy', onBusy);
    };
  }, [
    currentUser.user_id,
    debugLog,
    isTimeoutLikeError,
    onIncomingCall,
    preparePeer,
    resetCall,
    socket,
  ]);

  useEffect(() => {
    debugLog('state:phase', {
      phase,
      callId: call?.callId ?? null,
      status: call?.status ?? null,
      otherUserId,
    });
  }, [call?.callId, call?.status, debugLog, otherUserId, phase]);

  useEffect(() => {
    const webrtc = webrtcRef.current;
    return () => {
      webrtc.stop();
    };
  }, []);

  return {
    phase,
    call,
    otherUserId,
    localStream,
    remoteStream,
    micOn,
    cameraOn,
    error,
    clearError: () => setError(''),
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
  };
}
