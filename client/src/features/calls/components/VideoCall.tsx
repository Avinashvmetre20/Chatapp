import { useEffect, useRef } from 'react';
import { CallControls } from './CallControls';
import type { CallPhase, CallType } from '../types/call.types';

type VideoCallProps = {
  peerName: string;
  callType: CallType;
  phase: CallPhase;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
};

function phaseLabel(phase: CallPhase) {
  if (phase === 'outgoing') {
    return 'Calling…';
  }
  if (phase === 'connecting') {
    return 'Connecting…';
  }
  return '';
}

export function VideoCall({
  peerName,
  callType,
  phase,
  localStream,
  remoteStream,
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onEnd,
}: VideoCallProps) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (remoteRef.current) {
      remoteRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localRef.current) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const status = phaseLabel(phase);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1">
        {callType === 'video' && remoteStream ? (
          <video
            autoPlay
            className="h-full w-full object-cover"
            playsInline
            ref={remoteRef}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-2xl font-medium">{peerName}</p>
            <p className="text-sm text-white/70">{status || 'In call'}</p>
          </div>
        )}

        {status && remoteStream ? (
          <p className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm">
            {status}
          </p>
        ) : null}

        {callType === 'audio' ? (
          <audio autoPlay ref={remoteAudioRef} />
        ) : null}

        {callType === 'video' ? (
          <video
            autoPlay
            className="absolute right-4 bottom-24 h-36 w-28 rounded-xl object-cover shadow-lg sm:h-44 sm:w-32"
            muted
            playsInline
            ref={localRef}
          />
        ) : null}
      </div>

      <div className="bg-black/80 px-4 py-5">
        <CallControls
          cameraOn={cameraOn}
          micOn={micOn}
          onEnd={onEnd}
          onToggleCamera={onToggleCamera}
          onToggleMic={onToggleMic}
          showCameraToggle={callType === 'video'}
        />
      </div>
    </div>
  );
}
