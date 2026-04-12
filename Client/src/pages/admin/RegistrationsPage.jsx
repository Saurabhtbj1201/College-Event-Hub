import { useEffect, useState } from "react";
import { getRegistrations } from "../../api/adminApi";
import { formatDateTime } from "../../utils/date";

const RegistrationsPage = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRegistrations = async () => {
      try {
        const data = await getRegistrations();
        setRegistrations(data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load registrations");
      } finally {
        setLoading(false);
      }
    };

    loadRegistrations();
  }, []);

  if (loading) {
    return <p className="text-slate-600">Loading registrations...</p>;
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-slate-900">Registered Users</h1>
      <p className="mt-2 text-sm text-slate-600">Only admins can view all participant registrations.</p>

      {registrations.length === 0 ? (
        <p className="mt-5 rounded-xl border border-slate-200 p-4 text-slate-600">No registrations yet.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">College</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Pass ID</th>
                <th className="px-4 py-3">Registered At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
              {registrations.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3">{item.email}</td>
                  <td className="px-4 py-3">{item.phone}</td>
                  <td className="px-4 py-3">{item.college}</td>
                  <td className="px-4 py-3">{item.event?.title || item.eventSnapshot?.title}</td>
                  <td className="px-4 py-3">{item.passId}</td>
                  <td className="px-4 py-3">{formatDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RegistrationsPage;
