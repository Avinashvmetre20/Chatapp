type CallControlsProps = {
  micOn: boolean;
  cameraOn: boolean;
  showCameraToggle: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
};

export function CallControls({
  micOn,
  cameraOn,
  showCameraToggle,
  onToggleMic,
  onToggleCamera,
  onEnd,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        className={`rounded-full px-4 py-3 text-sm font-medium text-white ${
          micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-400'
        }`}
        onClick={onToggleMic}
        type="button"
      >
        {micOn ? 'Mute' : 'Unmute'}
      </button>
      {showCameraToggle ? (
        <button
          className={`rounded-full px-4 py-3 text-sm font-medium text-white ${
            cameraOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-400'
          }`}
          onClick={onToggleCamera}
          type="button"
        >
          {cameraOn ? 'Camera off' : 'Camera on'}
        </button>
      ) : null}
      <button
        className="rounded-full bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-500"
        onClick={onEnd}
        type="button"
      >
        End call
      </button>
    </div>
  );
}
