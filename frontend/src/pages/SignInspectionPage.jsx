import { useState } from "react";
import SignatureCanvas from "../components/SignatureCanvas";
import api from "../api/client"; // Live API client connected to Render backend
import { triggerNotification } from "../utils/notifications";

export default function SignInspectionPage({
  property,
  inspectionId,
  userRole = "tenant", // "landlord" or "tenant"
  onBack,
  onSignaturesComplete,
  initialSignatures,
}) {
  const safeProperty = property || null;
  const propertyKey = safeProperty?.propertyId || safeProperty?.id;

  const [signatures, setSignatures] = useState(
    initialSignatures || { landlord: null, tenant: null },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentRole = String(userRole).toLowerCase();
  const isLandlord = currentRole.includes("landlord");
  const isTenant = currentRole.includes("tenant");

  // ✨ KEY LOGIC: Users only need to fill their OWN respective signature field to complete!
  const isComplete = isLandlord ? Boolean(signatures.landlord) : isTenant ? Boolean(signatures.tenant) : Boolean(signatures.landlord && signatures.tenant);

  const handleLockAndSign = async () => {
    if (!isComplete) return;
    setIsSubmitting(true);

    try {
      if (inspectionId) {
        await api.post(`/inspections/${inspectionId}/acknowledge`, {
          signatures,
        });
      }

      if (propertyKey) {
        triggerNotification(
          propertyKey,
          "Signature Recorded",
          `${isLandlord ? "Landlord" : "Tenant"} signed the inspection report.`,
          "invite"
        );

        const isBothSigned = Boolean(signatures.landlord && signatures.tenant);
        if (isBothSigned) {
          triggerNotification(
            propertyKey,
            "Inspection Sealed",
            "Both parties have signed. Move-out compartment is now unlocked.",
            "system"
          );
        }
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
            ← Back
          </button>
          <h2 className="text-sm font-extrabold text-[#4A1E6D]">
            {isLandlord ? "Landlord Signature" : "Tenant Signature"}
          </h2>
        </div>

        <p className="text-xs text-slate-600 font-medium">
          Please provide your digital signature to acknowledge and lock your portion of this report.
        </p>

        {/* Signature Canvas Components with Role Gating */}
        <div className="space-y-4">
          
          {/* Landlord Field: Editable ONLY if user is landlord */}
          <div className="space-y-1">
            {isLandlord ? (
              <SignatureCanvas
                label="Landlord Signature (Your Role)"
                savedSignature={signatures.landlord}
                onSave={(sig) =>
                  setSignatures((prev) => ({ ...prev, landlord: sig }))
                }
              />
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Landlord Signature</span>
                <span className={`text-xs font-extrabold ${signatures.landlord ? "text-emerald-700" : "text-amber-600"}`}>
                  {signatures.landlord ? "Signed ✓" : "Awaiting Landlord"}
                </span>
              </div>
            )}
          </div>

          {/* Tenant Field: Editable ONLY if user is tenant */}
          <div className="space-y-1">
            {isTenant ? (
              <SignatureCanvas
                label="Tenant Signature (Your Role)"
                savedSignature={signatures.tenant}
                onSave={(sig) =>
                  setSignatures((prev) => ({ ...prev, tenant: sig }))
                }
              />
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Tenant Signature</span>
                <span className={`text-xs font-extrabold ${signatures.tenant ? "text-emerald-700" : "text-amber-600"}`}>
                  {signatures.tenant ? "Signed ✓" : "Awaiting Tenant"}
                </span>
              </div>
            )}
          </div>

        </div>

        <button
          type="button"
          disabled={!isComplete || isSubmitting}
          onClick={handleLockAndSign}
          className="w-full bg-[#4A1E6D] hover:bg-purple-950 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg cursor-pointer"
        >
          {isSubmitting ? "Locking to Database..." : "Save Signature & Proceed →"}
        </button>
      </div>
    </div>
  );
}