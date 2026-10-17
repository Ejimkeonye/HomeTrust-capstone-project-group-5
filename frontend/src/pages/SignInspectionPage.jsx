import { useState } from "react";
import SignatureCanvas from "../components/SignatureCanvas";
import api from "../api/client"; // Live API client connected to Render backend

export default function SignInspectionPage({
  inspectionId,
  onBack,
  onSignaturesComplete,
  initialSignatures,
}) {
  const [signatures, setSignatures] = useState(
    initialSignatures || { landlord: null, tenant: null },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isComplete = signatures.landlord && signatures.tenant;

  const handleLockAndSign = async () => {
    if (!isComplete) return;
    setIsSubmitting(true);

    try {
      if (inspectionId) {
        // Calls your backend controller `approveInspection`
        await api.post(`/inspections/${inspectionId}/acknowledge`, {
          signatures,
        });
      }
    } catch (err) {
      console.warn("Backend signature acknowledgement notice:", err?.response?.data || err?.message);
    } finally {
      setIsSubmitting(false);
      onSignaturesComplete(signatures);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <button
            onClick={onBack}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            ← Back to Evidence Review
          </button>
          <h2 className="text-sm font-extrabold text-[#4A1E6D]">
            Signatures Required
          </h2>
        </div>

        <p className="text-xs text-slate-600 font-medium">
          Please provide digital signatures to lock and seal this inspection
          report.
        </p>

        {/* Signature Canvas Components */}
        <div className="space-y-4">
          <SignatureCanvas
            label="Landlord Signature"
            savedSignature={signatures.landlord}
            onSave={(sig) =>
              setSignatures((prev) => ({ ...prev, landlord: sig }))
            }
          />
          <SignatureCanvas
            label="Tenant Signature"
            savedSignature={signatures.tenant}
            onSave={(sig) =>
              setSignatures((prev) => ({ ...prev, tenant: sig }))
            }
          />
        </div>

        <button
          type="button"
          disabled={!isComplete || isSubmitting}
          onClick={handleLockAndSign}
          className="w-full bg-[#4A1E6D] hover:bg-purple-950 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg cursor-pointer"
        >
          {isSubmitting ? "Locking to Database..." : "Lock & Proceed to Final Report →"}
        </button>
      </div>
    </div>
  );
}