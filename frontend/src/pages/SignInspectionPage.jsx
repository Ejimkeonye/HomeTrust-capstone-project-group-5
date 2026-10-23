import { useCallback, useEffect, useState } from "react";
import SignatureCanvas from "../components/SignatureCanvas";
import api from "../api/client";
import { triggerNotification } from "../utils/notifications";

const emptySignatures = { landlord: null, tenant: null };

function getPayload(response) {
  const body = response?.data || {};

  // Keep top-level signingStatus/state/signatures when the API also nests
  // the inspection object in the response.
  if (body.inspection && typeof body.inspection === "object") {
    return { ...body.inspection, ...body };
  }
  if (body.data?.inspection && typeof body.data.inspection === "object") {
    return { ...body.data.inspection, ...body.data };
  }
  return body.data ?? body;
}

function selectInspection(payload, propertyKey, roleKey) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.inspections)
      ? payload.inspections
      : Array.isArray(payload?.data)
        ? payload.data
        : [payload];

  // The property endpoint returns { inspections: [...], total }, and a property
  // may have multiple inspections. Prefer one under review that this party has
  // not signed yet; otherwise use the most recently updated matching inspection.
  const matching = candidates.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      item.mode !== "MoveOut" &&
      (!propertyKey ||
        String(
          item?.propertyId ?? item?.property?.propertyId ?? item?.property?.id,
        ) === String(propertyKey)),
  );
  if (!matching.length) return null;

  const signatureField =
    roleKey === "landlord" ? "landlordSignature" : "tenantSignature";
  const signable = matching.filter(
    (item) =>
      item.state === "UNDER_REVIEW" &&
      !isPersistedSignature(item.signatures?.[roleKey]) &&
      !isPersistedSignature(item[signatureField]),
  );
  const pool = signable.length ? signable : matching;
  pool.sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(
      String(a.updatedAt || a.createdAt || ""),
    ),
  );
  return pool[0] || null;
}

function getSignatureImageUrl(signature) {
  if (typeof signature === "string") {
    return signature.startsWith("data:image/") ||
      /^https?:\/\//i.test(signature)
      ? signature
      : null;
  }

  if (!signature || typeof signature !== "object") return null;

  const candidate =
    signature.url ||
    signature.imageUrl ||
    signature.signatureUrl ||
    signature.signedImageUrl ||
    signature.dataUrl ||
    signature.signature;

  return typeof candidate === "string" &&
    (candidate.startsWith("data:image/") || /^https?:\/\//i.test(candidate))
    ? candidate
    : null;
}

function isPersistedSignature(signature) {
  if (typeof signature === "string")
    return (
      signature.startsWith("data:image/") || /^https?:\/\//i.test(signature)
    );
  return Boolean(
    signature &&
    typeof signature === "object" &&
    signature.uploadedAt &&
    (signature.objectKey || getSignatureImageUrl(signature)),
  );
}

function getCanonicalSignature(inspection, roleKey) {
  const field =
    roleKey === "landlord" ? "landlordSignature" : "tenantSignature";
  const canonical = inspection?.[field];
  if (isPersistedSignature(canonical)) return canonical;
  const legacy = inspection?.signatures?.[roleKey];
  return isPersistedSignature(legacy) ? legacy : null;
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

export default function SignInspectionPage({
  property,
  inspectionId,
  userRole = "tenant",
  onBack,
  onDashboard,
  onSignaturesComplete,
}) {
  const propertyKey = property?.propertyId || property?.id;
  const currentRole = String(userRole).toLowerCase();
  const isLandlord = currentRole.includes("landlord");
  const isTenant = currentRole.includes("tenant");
  const roleKey = isLandlord ? "landlord" : isTenant ? "tenant" : null;
  const roleLabel = isLandlord ? "Landlord" : "Tenant";

  const [activeInspectionId, setActiveInspectionId] = useState(
    inspectionId || null,
  );
  const [savedSignatures, setSavedSignatures] = useState(emptySignatures);
  const [draftSignature, setDraftSignature] = useState(null);

  const [inspectionState, setInspectionState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const loadInspection = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      let resolvedId = inspectionId || activeInspectionId || null;
      let response;

      if (resolvedId) {
        response = await api.get(`/inspections/${resolvedId}`);
      } else if (propertyKey) {
        // Backend-supported recovery path when the parent has lost the ID.
        response = await api.get(`/inspections/property/${propertyKey}`);
      } else {
        throw new Error("The inspection ID and property ID are both missing.");
      }

      let inspection = selectInspection(
        getPayload(response),
        propertyKey,
        roleKey,
      );
      if (!inspection || typeof inspection !== "object") {
        throw new Error(
          "The backend did not return an inspection for this property.",
        );
      }

      if (inspection.mode === "MoveOut") {
        throw new Error(
          "This is a Move-Out inspection. Open the Move-Out signature page instead.",
        );
      }

      const returnedId = inspection.inspectionId || inspection.id;
      if (!resolvedId && returnedId) {
        resolvedId = returnedId;
        setActiveInspectionId(returnedId);
      }

      if (!resolvedId) {
        throw new Error(
          "The inspection was found, but the backend response did not include its inspection ID.",
        );
      }

      if (
        inspection.inspectionId &&
        String(inspection.inspectionId) !== String(resolvedId)
      ) {
        throw new Error("The requested inspection could not be verified.");
      }

      // GET /inspections/:id is the source of truth for saved signatures/state.
      setSavedSignatures({
        landlord: getCanonicalSignature(inspection, "landlord"),
        tenant: getCanonicalSignature(inspection, "tenant"),
      });
      setInspectionState(inspection.state || null);
      setDraftSignature(null);
    } catch (error) {
      setLoadError(
        getErrorMessage(
          error,
          "Unable to load saved signatures. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [inspectionId, activeInspectionId, propertyKey, roleKey]);

  useEffect(() => {
    let isActive = true;
    Promise.resolve().then(() => {
      if (isActive) loadInspection();
    });

    return () => {
      isActive = false;
    };
  }, [loadInspection]);

  const alreadySigned = Boolean(
    roleKey && isPersistedSignature(savedSignatures[roleKey]),
  );
  const isFinalized = inspectionState === "READ_ONLY";
  const canSubmit =
    Boolean(roleKey) &&
    Boolean(activeInspectionId) &&
    Boolean(draftSignature) &&
    !alreadySigned &&
    !isFinalized &&
    !isLoading &&
    !isSubmitting &&
    !loadError;

  const handleSaveSignature = async () => {
    if (!canSubmit) return;

    if (!draftSignature?.startsWith("data:image/png;base64,")) {
      setSubmitError("Please draw and save your signature before continuing.");

      return;
    }

    setIsSubmitting(true);

    setSubmitError("");

    try {
      // Submit only this party's signature. The backend identifies the signer.

      const response = await api.post(
        `/inspections/${activeInspectionId}/signatures`,

        { signature: draftSignature },
      );

      const result = getPayload(response);
const returnedId = result.inspectionId || result.id;
const returnedPropertyId =
  result.propertyId || result.property?.propertyId || result.property?.id;
const returnedSignatures = result.signatures;
const savedSignature = getCanonicalSignature(result, roleKey);

if (
  String(returnedId || "") !== String(activeInspectionId || "") ||
  String(returnedPropertyId || "") !== String(propertyKey || "") ||
  result.mode === "MoveOut" ||
  !isPersistedSignature(savedSignature)
) {
  throw new Error(
    "The server response could not be verified against this Move-In inspection. Reload and check the saved state before trying again.",
  );
}

      const confirmedSignatures = {
        landlord: returnedSignatures.landlord ?? null,

        tenant: returnedSignatures.tenant ?? null,
      };

      setSavedSignatures(confirmedSignatures);

      setInspectionState(result.state || null);

      setDraftSignature(null);

      if (propertyKey) {
        triggerNotification(
          propertyKey,

          "Signature Recorded",

          `${roleLabel} signature saved to the inspection.`,

          "invite",
        );

        // Finalization is determined only by the backend state.

        if (result.state === "READ_ONLY") {
          triggerNotification(
            propertyKey,

            "Inspection Sealed",

            "Both parties' signatures have been saved. The inspection is finalized.",

            "system",
          );
        }
      }

      // The parent can update its UI, but must not infer finalization

      // from the presence of two signature records.

      onSignaturesComplete?.(confirmedSignatures, {
        state: result.state || null,

        signingStatus: result.signingStatus || null,

        inspection: result,
      });
    } catch (error) {
      setSubmitError(
        getErrorMessage(
          error,

          "Your signature could not be saved. Please try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const landlordImage = getSignatureImageUrl(savedSignatures.landlord);

  const tenantImage = getSignatureImageUrl(savedSignatures.tenant);
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-6xl mx-auto px-4 bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between gap-2 border-b pb-4">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            ← Back
          </button>

          <h2 className="flex-1 text-center text-sm font-extrabold text-[#4A1E6D]">
            {roleKey ? `${roleLabel} Signature` : "Inspection Signatures"}
          </h2>

          <button
            type="button"
            onClick={onDashboard}
            className="whitespace-nowrap rounded-lg bg-[#4A1E6D] px-3 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            Dashboard
          </button>
        </div>

        <p className="text-xs text-slate-600 font-medium">
          Sign to acknowledge the inspection. Your signature will be saved to
          the inspection record.
        </p>

        {!roleKey && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700"
          >
            Your account role could not be identified as landlord or tenant.
          </div>
        )}

        {isLoading && (
          <p role="status" className="text-sm text-slate-500">
            Loading saved inspection and signatures...
          </p>
        )}

        {loadError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 space-y-2"
          >
            <p>{loadError}</p>

            <button
              type="button"
              onClick={loadInspection}
              className="font-bold underline"
            >
              Retry loading
            </button>
          </div>
        )}

        {!isLoading && !loadError && (
          <>
            {isFinalized && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                This inspection is finalized and read-only according to the
                backend.
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Landlord signature
                </p>

                {savedSignatures.landlord ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {landlordImage ? (
                      <img
                        src={landlordImage}
                        alt="Saved landlord signature"
                        className="h-20 max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-emerald-700">
                        Signature saved
                      </p>
                    )}

                    <p className="text-xs font-semibold text-emerald-700">
                      Saved on the backend ✓
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    Awaiting landlord signature
                  </p>
                )}

                {isLandlord && !alreadySigned && !isFinalized && (
                  <SignatureCanvas
                    label="Draw your landlord signature"
                    savedSignature={draftSignature}
                    onSave={setDraftSignature}
                    disabled={
                      isLoading ||
                      isSubmitting ||
                      Boolean(loadError) ||
                      inspectionState !== "UNDER_REVIEW"
                    }
                  />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Tenant signature
                </p>

                {savedSignatures.tenant ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {tenantImage ? (
                      <img
                        src={tenantImage}
                        alt="Saved tenant signature"
                        className="h-20 max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-emerald-700">
                        Signature saved
                      </p>
                    )}

                    <p className="text-xs font-semibold text-emerald-700">
                      Saved on the backend ✓
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    Awaiting tenant signature
                  </p>
                )}

                {isTenant && !alreadySigned && !isFinalized && (
                  <SignatureCanvas
                    label="Draw your tenant signature"
                    savedSignature={draftSignature}
                    onSave={setDraftSignature}
                    disabled={
                      isLoading ||
                      isSubmitting ||
                      Boolean(loadError) ||
                      inspectionState !== "UNDER_REVIEW"
                    }
                  />
                )}
              </div>
            </div>

            {alreadySigned && !isFinalized && (
              <p className="text-sm text-emerald-700">
                Your signature is already saved. The other linked party may
                still need to sign.
              </p>
            )}

            {submitError && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700"
              >
                {submitError}

                <button
                  type="button"
                  onClick={loadInspection}
                  className="ml-2 font-bold underline"
                >
                  Reload saved state
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSaveSignature}
              className="w-full bg-[#4A1E6D] hover:bg-purple-950 disabled:opacity-40 text-white font-extrabold py-3.5 rounded-2xl text-xs transition-colors shadow-lg"
            >
              {isSubmitting
                ? "Saving signature to database..."
                : alreadySigned
                  ? "Your Signature Is Saved"
                  : isFinalized
                    ? "Inspection Finalized"
                    : "Submit My Signature →"}
            </button>

            <p className="text-xs text-slate-500">
              Backend inspection state: {inspectionState || "Not specified"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
