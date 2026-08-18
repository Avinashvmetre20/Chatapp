import type { IceServer, MediaPermissionError } from '../types/call.types';

export function mapMediaError(error: unknown): {
  code: MediaPermissionError;
  message: string;
} {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      code: 'not-supported',
      message: 'This browser does not support audio or video calling.',
    };
  }

  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'permission-denied',
      message: 'Camera or microphone permission was denied.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'device-unavailable',
      message: 'Camera or microphone was not found.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'device-in-use',
      message: 'Camera or microphone is already in use.',
    };
  }

  return {
    code: 'unknown',
    message: error instanceof Error ? error.message : 'Could not access media devices.',
  };
}

type WebRtcHandlers = {
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
};

export class WebRtcService {
  private peer: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];

  getLocalStream() {
    return this.localStream;
  }

  isReady() {
    return this.peer !== null;
  }

  async startLocalMedia(video: boolean) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException('WebRTC is not supported', 'NotSupportedError');
    }

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video,
    });
    return this.localStream;
  }

  createPeer(iceServers: IceServer[], handlers: WebRtcHandlers) {
    this.closePeer();
    this.pendingIce = [];
    this.peer = new RTCPeerConnection({ iceServers });

    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        handlers.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.peer.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      handlers.onRemoteStream(stream);
    };

    this.peer.onconnectionstatechange = () => {
      const state = this.peer?.connectionState;
      if (state) {
        handlers.onConnectionState?.(state);
      }
    };

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.peer.addTrack(track, this.localStream);
      }
    }

    return this.peer;
  }

  async createOffer() {
    if (!this.peer) {
      throw new Error('Peer connection is not ready');
    }
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (!this.peer) {
      throw new Error('Peer connection is not ready');
    }
    await this.peer.setRemoteDescription(sdp);
    await this.flushIce();
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (!this.peer) {
      throw new Error('Peer connection is not ready');
    }
    await this.peer.setRemoteDescription(sdp);
    await this.flushIce();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peer?.remoteDescription) {
      this.pendingIce.push(candidate);
      return;
    }
    await this.peer.addIceCandidate(candidate);
  }

  setMicEnabled(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  setCameraEnabled(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  stop() {
    this.closePeer();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    this.pendingIce = [];
  }

  private async flushIce() {
    if (!this.peer) {
      return;
    }
    const queued = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of queued) {
      await this.peer.addIceCandidate(candidate);
    }
  }

  private closePeer() {
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
      this.peer = null;
    }
  }
}
