import { useState } from "react";
import { createEvent } from "../../api/adminApi";

const initialForm = {
  title: "",
  date: "",
  venue: "",
  description: "",
  capacity: "",
};

const CreateEventPage = () => {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await createEvent({
        ...form,
        date: new Date(form.date).toISOString(),
        capacity: Number(form.capacity),
      });
      setSuccess("Event created successfully");
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-slate-900">Create Event</h1>
      <p className="mt-2 text-sm text-slate-600">Add a new event that will appear on the public website.</p>

      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl bg-green-50 p-3 text-green-700">{success}</p> : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
          <input
            required
            name="title"
            value={form.title}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Date & Time</span>
          <input
            required
            type="datetime-local"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Venue</span>
          <input
            required
            name="venue"
            value={form.venue}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <textarea
            required
            rows={5}
            name="description"
            value={form.description}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Capacity</span>
          <input
            required
            type="number"
            min={1}
            name="capacity"
            value={form.capacity}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Creating..." : "Create Event"}
        </button>
      </form>
    </div>
  );
};

export default CreateEventPage;
