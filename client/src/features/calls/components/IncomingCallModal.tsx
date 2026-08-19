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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center p-3 sm:p-4">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-2xl sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Incoming {callType} call
        </p>
        <h2 className="mt-1 text-lg font-semibold text-gray-900">{callerName}</h2>
        <div className="mt-4 flex gap-2 sm:gap-3">
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
