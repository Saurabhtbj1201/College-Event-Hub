import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { getPassById } from "../../api/publicApi";
import { useToast } from "../../contexts/ToastContext";
import { formatDateTime } from "../../utils/date";

const PassPage = () => {
  const { passId } = useParams();
  const location = useLocation();
  const toast = useToast();

  const [data, setData] = useState(() => location.state?.preloadedPassData || null);
  const [loading, setLoading] = useState(!location.state?.preloadedPassData);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPass = async () => {
      if (location.state?.preloadedPassData?.pass?.passId === passId) {
        return;
      }

      try {
        setLoading(true);
        const response = await getPassById(passId);
        setData(response);
      } catch (err) {
        const message = err.response?.data?.message || "Unable to fetch pass details";
        setError(message);
        toast.error(message, "Pass unavailable");
      } finally {
        setLoading(false);
      }
    };

    fetchPass();
  }, [passId, location.state]);

  if (loading) {
    return <p className="text-slate-600">Loading your pass...</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error || "Pass not found"}</p>
        <Link to="/" className="text-brand-700">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Event Pass</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-slate-900">Registration Confirmed</h1>
      <p className="mt-2 text-slate-600">Show this QR pass at the event entry.</p>

      <div className="mt-7 grid gap-6 md:grid-cols-[1fr_220px] md:items-center">
        <div className="space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Pass ID:</span> {data.pass.passId}
          </p>
          <p>
            <span className="font-semibold">Name:</span> {data.registration.name}
          </p>
          <p>
            <span className="font-semibold">Email:</span> {data.registration.email}
          </p>
          <p>
            <span className="font-semibold">Event:</span> {data.pass.eventTitle}
          </p>
          <p>
            <span className="font-semibold">Venue:</span> {data.pass.eventVenue}
          </p>
          <p>
            <span className="font-semibold">Date:</span> {formatDateTime(data.pass.eventDate)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
          <QRCodeCanvas value={data.pass.qrValue} size={170} includeMargin />
          <p className="mt-3 text-xs text-slate-500">Scan for verification</p>
        </div>
      </div>

      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Register Another Event
        </Link>
      </div>
    </div>
  );
};

export default PassPage;
