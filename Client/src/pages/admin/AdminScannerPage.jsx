import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { scanTicketCheckIn } from "../../api/adminApi";
import { formatDateTime } from "../../utils/date";

const SCANNER_ELEMENT_ID = "cem-scanner-reader";

const extractPassId = (scanPayload) => {
  const value = String(scanPayload || "").trim();

  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed?.passId === "string") {
      return parsed.passId.trim();
    }
  } catch (error) {
    // Fallback: raw QR text may already be passId.
  }

  return value;
};

const AdminScannerPage = () => {
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const lastScannedRef = useRef({ value: "", time: 0 });

  const [manualValue, setManualValue] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const processScanPayload = async (scanPayload) => {
    const normalized = String(scanPayload || "").trim();

    if (!normalized) {
      return;
    }

    const now = Date.now();
    if (
      lastScannedRef.current.value === normalized &&
      now - lastScannedRef.current.time < 2500
    ) {
      return;
    }

    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    lastScannedRef.current = { value: normalized, time: now };
    setError("");

    try {
      const response = await scanTicketCheckIn({ scanPayload: normalized });
      setResult({
        status: "success",
        payload: response,
        scannedAt: new Date().toISOString(),
      });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || "Scan failed";

      setResult({
        status: status === 409 ? "duplicate" : "error",
        payload: err.response?.data,
        scannedAt: new Date().toISOString(),
      });
      setError(message);
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      SCANNER_ELEMENT_ID,
      {
        fps: 10,
        qrbox: { width: 260, height: 260 },
      },
      false
    );

    scanner.render(
      (decodedText) => {
        processScanPayload(decodedText);
      },
      () => {
        // Ignore decode errors from camera frames.
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {
          // Ignore cleanup errors.
        });
        scannerRef.current = null;
      }
    };
  }, []);

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    await processScanPayload(manualValue);
    setManualValue("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Smart Ticket Scanner</h1>
        <p className="mt-2 text-sm text-slate-600">
          Scan attendee QR pass using webcam or submit pass ID manually.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 p-4">
          <div id={SCANNER_ELEMENT_ID} />
        </section>

        <section className="space-y-4">
          <form
            onSubmit={handleManualSubmit}
            className="rounded-2xl border border-slate-200 p-4"
          >
            <h2 className="font-display text-lg font-semibold text-slate-900">Manual Check-In</h2>
            <p className="mt-1 text-sm text-slate-600">
              Paste raw QR payload or pass ID directly.
            </p>

            <input
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder='PASS-XXXX or {"passId":"PASS-XXXX"}'
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-500"
            />

            <button
              type="submit"
              className="mt-3 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              Validate and Check-In
            </button>
          </form>

          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          {result ? (
            <article
              className={`rounded-2xl border p-4 ${
                result.status === "success"
                  ? "border-emerald-200 bg-emerald-50"
                  : result.status === "duplicate"
                  ? "border-amber-200 bg-amber-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {result.status === "success"
                  ? "Check-In Successful"
                  : result.status === "duplicate"
                  ? "Already Checked In"
                  : "Check-In Failed"}
              </p>

              <p className="mt-2 text-sm text-slate-800">
                Pass: {extractPassId(result.payload?.scanPayload || result.payload?.passId || result.payload?.checkIn?.passId)}
              </p>

              {result.payload?.checkIn ? (
                <>
                  <p className="mt-1 text-sm text-slate-800">Name: {result.payload.checkIn.name}</p>
                  <p className="mt-1 text-sm text-slate-800">Event: {result.payload.checkIn.eventTitle}</p>
                </>
              ) : null}

              <p className="mt-2 text-xs text-slate-600">Processed: {formatDateTime(result.scannedAt)}</p>
            </article>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default AdminScannerPage;
