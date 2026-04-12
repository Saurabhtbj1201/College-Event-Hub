import { useEffect, useState } from "react";
import { getPendingAdmins, updateAdminApproval } from "../../api/adminApi";
import { formatDateTime } from "../../utils/date";

const PendingAdminsPage = () => {
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState("");

  const loadPending = async () => {
    try {
      const data = await getPendingAdmins();
      setPendingAdmins(data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load pending admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleDecision = async (adminId, approved) => {
    setProcessingId(adminId);
    setError("");

    try {
      await updateAdminApproval(adminId, approved);
      await loadPending();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update approval status");
    } finally {
      setProcessingId("");
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading pending admin requests...</p>;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-slate-900">Pending Admin Requests</h1>
      <p className="mt-2 text-sm text-slate-600">Only super-admin can approve or reject admin accounts.</p>

      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}

      {pendingAdmins.length === 0 ? (
        <p className="mt-5 rounded-xl border border-slate-200 p-4 text-slate-600">No pending requests.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {pendingAdmins.map((admin) => (
            <article
              key={admin._id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">{admin.name}</p>
                <p className="text-sm text-slate-600">{admin.email}</p>
                <p className="text-xs text-slate-500">Requested: {formatDateTime(admin.createdAt)}</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={processingId === admin._id}
                  onClick={() => handleDecision(admin._id, true)}
                  className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={processingId === admin._id}
                  onClick={() => handleDecision(admin._id, false)}
                  className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingAdminsPage;
