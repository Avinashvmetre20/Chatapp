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
        setError('You are offline. Reconnect before calling.');
        return;
      }
      if (phase !== 'idle') {
        return;
      }

      setError('');
      setPhase('outgoing');
      setCameraOn(callType === 'video');

      try {
        iceServersRef.current = await getIceServers();
        const stream = await webrtcRef.current.startLocalMedia(callType === 'video');
        setLocalStream(stream);
        const nextCall = await callSocket.initiate(socket, {
          receiverId,
          callType,
        });
        callRef.current = nextCall;
        setCall(nextCall);
      } catch (err) {
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
    [phase, resetCall, socket],
  );

  const acceptCall = useCallback(async () => {
    if (!socket || !callRef.current) {
      return;
    }

    const activeCall = callRef.current;
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
  }, [preparePeer, resetCall, socket]);

  const rejectCall = useCallback(async () => {
    if (!socket || !callRef.current) {
      resetCall();
      return;
    }
    try {
      await callSocket.reject(socket, callRef.current.callId);
    } finally {
      resetCall();
    }
  }, [resetCall, socket]);

  const endCall = useCallback(async () => {
    if (endingRef.current) {
      return;
    }
    endingRef.current = true;
    const activeCall = callRef.current;
    try {
      if (socket && activeCall) {
        await callSocket.end(socket, activeCall.callId);
      }
    } catch {
      // Hang up locally even if the signaling ack fails.
    } finally {
      resetCall();
    }
  }, [resetCall, socket]);

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
      if (incoming.receiverId === currentUser.user_id) {
        callRef.current = incoming;
        setCall(incoming);
        setPhase('incoming');
        onIncomingCall?.(incoming);
        return;
      }
      if (incoming.callerId === currentUser.user_id) {
        callRef.current = incoming;
        setCall(incoming);
      }
    };

    const onAccept = ({ call: accepted }: CallEnvelope) => {
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
          setError(err instanceof Error ? err.message : 'Could not send call offer');
        }
      })();
    };

    const onOffer = ({ callId, sdp }: OfferEnvelope) => {
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
          setError(err instanceof Error ? err.message : 'Could not answer the call');
        }
      })();
    };

    const onAnswer = ({ callId, sdp }: OfferEnvelope) => {
      if (callId !== callRef.current?.callId) {
        return;
      }
      void webrtcRef.current.handleAnswer(sdp).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not connect the call');
      });
    };

    const onIce = ({ callId, candidate }: IceEnvelope) => {
      if (callId !== callRef.current?.callId) {
        return;
      }
      void webrtcRef.current.addIceCandidate(candidate);
    };

    const onClosed = ({ call: closed }: CallEnvelope) => {
      if (closed.callId !== callRef.current?.callId) {
        return;
      }
      resetCall();
    };

    const onTimeout = ({ call: timedOut }: CallEnvelope) => {
      if (timedOut.callId !== callRef.current?.callId) {
        return;
      }
      resetCall();
      setError('The call was not answered.');
    };

    const onBusy = ({ call: busy }: CallEnvelope) => {
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
  }, [currentUser.user_id, onIncomingCall, preparePeer, resetCall, socket]);

  useEffect(() => {
    return () => {
      webrtcRef.current.stop();
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
