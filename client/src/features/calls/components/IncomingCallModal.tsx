type IncomingCallModalProps = {
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallModal({
  callerName,
  callType,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Incoming {callType} call
        </p>
        <h2 className="mt-2 text-xl font-semibold text-gray-900">{callerName}</h2>
        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100"
            onClick={onReject}
            type="button"
          >
            Reject
          </button>
          <button
            className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-500"
            onClick={onAccept}
            type="button"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
