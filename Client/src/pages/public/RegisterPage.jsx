import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPublicEventById, registerForEvent } from "../../api/publicApi";
import { formatDateTime } from "../../utils/date";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  college: "",
};

const RegisterPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const data = await getPublicEventById(eventId);
        setEvent(data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load event");
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const handleChange = (eventInput) => {
    const { name, value } = eventInput.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (submitEvent) => {
    submitEvent.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await registerForEvent(eventId, form);
      navigate(`/pass/${response.pass.passId}`, {
        state: { preloadedPassData: response },
      });
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-slate-600">Loading registration form...</p>;
  }

  if (error && !event) {
    return <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Event Registration</h1>
        <p className="mt-2 text-sm text-slate-600">Fill your details to generate your event pass.</p>

        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Full Name</span>
            <input
              required
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input
              required
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
            <input
              required
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">College</span>
            <input
              required
              name="college"
              value={form.college}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-brand-500"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Submitting..." : "Submit and Generate Pass"}
        </button>
      </form>

      <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Registering For</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">{event.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{event.venue}</p>
        <p className="mt-1 text-sm text-slate-600">{formatDateTime(event.date)}</p>
        <p className="mt-4 text-sm text-slate-700">{event.description}</p>
      </aside>
    </div>
  );
};

export default RegisterPage;
