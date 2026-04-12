import { useState } from "react";
import { Link } from "react-router-dom";
import { registerAdmin } from "../../api/adminApi";

const AdminRegisterPage = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      const response = await registerAdmin({
        ...form,
        email: form.email.trim(),
      });
      setSuccess(response.message || "Admin registration submitted");
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to register admin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-hero-radial px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Admin Access Request</h1>
        <p className="mt-2 text-sm text-slate-600">Create an admin account request for super-admin approval.</p>

        {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p> : null}

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
            <input
              required
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
            <input
              required
              minLength={6}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          Already approved?{" "}
          <Link to="/admin/login" className="font-semibold text-brand-700">
            Login here
          </Link>
        </p>
      </form>
    </main>
  );
};

export default AdminRegisterPage;
