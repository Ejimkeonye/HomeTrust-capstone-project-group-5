import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import api from "../api/client";

export default function AuthPage({
  onSuccess,
  onAuthSuccess,
  onBack,
  inviteToken,
}) {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    role: "Tenant",
  });

  // Password validation
  const hasEightChars = formData.password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(formData.password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

  const passwordIsValid = hasEightChars && hasUpperCase && hasSpecialChar;

  // Email validation
  const cleanEmail = formData.email.trim().toLowerCase();

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

  // International phone validation.
  // Numbers without a + country code default to Nigeria.
  const parsedPhoneNumber = formData.phone.trim()
    ? parsePhoneNumberFromString(formData.phone.trim(), "NG")
    : undefined;

  const isValidPhone = Boolean(parsedPhoneNumber?.isValid());

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrorMessage("");
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMessage("Please enter your first and last name.");
      return;
    }

    if (!isValidEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!isValidPhone) {
      setErrorMessage(
        "Please enter a valid phone number. Include your country code for international numbers.",
      );
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLoading) return;

    setErrorMessage("");

    // Invitation acceptance belongs to the inspection invitation flow.
    if (inviteToken) {
      setErrorMessage(
        "Please continue through the inspection invitation screen to accept this invitation.",
      );
      return;
    }

    const triggerSuccess = onSuccess || onAuthSuccess;

    if (typeof triggerSuccess !== "function") {
      setErrorMessage(
        "Unable to continue. Please reload the page and try again.",
      );
      return;
    }

    if (!passwordIsValid) {
      setErrorMessage(
        "Your password must contain at least 8 characters, one uppercase letter, and one special character.",
      );
      return;
    }

    if (!isValidPhone) {
      setErrorMessage("Please enter a valid phone number.");
      setStep(1);
      return;
    }

    const fullName = [formData.firstName.trim(), formData.lastName.trim()].join(
      " ",
    );

    const backendRole = formData.role.toLowerCase().includes("landlord")
      ? "Landlord"
      : "Tenant";

    setIsLoading(true);

    let sessionData;

    try {
      const response = await api.post("/auth/register", {
        name: fullName,
        email: cleanEmail,
        password: formData.password,
        role: backendRole,
        phoneNumber: parsedPhoneNumber.number,
      });

      const { token, ...userData } = response.data;

      if (!token || !userData.userId) {
        throw new Error(
          "The server returned an incomplete registration response.",
        );
      }

      sessionData = {
        ...userData,
        token,
      };

      // Retained for compatibility with the existing frontend.
      // We will align these keys with App.jsx in the session review.
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));
    } catch (error) {
      console.error("Registration error:", error);

      setErrorMessage(
        error.response?.data?.message ||
          "Registration failed. Please check your details and try again.",
      );

      setIsLoading(false);
      return;
    }

    setIsLoading(false);

    try {
      triggerSuccess(sessionData);
    } catch (error) {
      console.error("Post-registration callback error:", error);

      setErrorMessage(
        "Your account was created, but we couldn't open your dashboard. Please sign in.",
      );
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center sm:p-8 p-4 font-sans">
      <div className="w-full max-w-md md:max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header Bar */}
        <div className="bg-purple-800 text-white p-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");

              if (step === 2) {
                setStep(1);
              } else {
                onBack?.();
              }
            }}
            aria-label={step === 2 ? "Back to personal details" : "Go back"}
            className="w-8 h-8 rounded-full border border-purple-400 flex items-center justify-center hover:bg-purple-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>

          <h1 className="text-xl font-bold tracking-wide">Create account</h1>

          <div className="w-8"></div>
        </div>

        {/* Step Progress */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
            <span
              className={step === 1 ? "text-purple-800" : "text-emerald-600"}
            >
              1. Personal details
            </span>

            <span className={step === 2 ? "text-purple-800" : ""}>
              2. Account security
            </span>
          </div>

          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full bg-purple-800 rounded-full transition-all duration-300 ${
                step === 1 ? "w-1/2" : "w-full"
              }`}
            />
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl"
          >
            {errorMessage}
          </div>
        )}

        {/* Step 1: Personal Details */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="p-6 space-y-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                First name
              </label>

              <input
                id="firstName"
                type="text"
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={60}
                placeholder="Clement"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                Last name
              </label>

              <input
                id="lastName"
                type="text"
                name="lastName"
                autoComplete="family-name"
                required
                maxLength={60}
                placeholder="John"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                Email address
              </label>

              <div className="relative">
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="clementjohn@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 pr-10"
                />

                {isValidEmail && (
                  <CheckCircle className="w-5 h-5 text-emerald-600 absolute right-3 top-3.5" />
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                Phone number
              </label>

              <input
                id="phone"
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                required
                maxLength={25}
                placeholder="e.g. +234 801 234 5678"
                value={formData.phone}
                onChange={handleChange}
                aria-invalid={formData.phone.trim().length > 0 && !isValidPhone}
                className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700"
              />

              <p className="text-xs text-slate-500 mt-1">
                Include your country code for international numbers, for example
                +1 for the US or +44 for the UK.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-purple-800 hover:bg-purple-900 text-white font-bold text-base py-3.5 rounded-2xl shadow-md transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Password, Role & Submission */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 pr-10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Dynamic Password Rules */}
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold mt-2">
                <span
                  className={
                    hasEightChars
                      ? "text-emerald-600 font-bold"
                      : "text-slate-400"
                  }
                >
                  {hasEightChars ? "✓ " : ""}
                  Must contain 8 characters
                </span>

                <span
                  className={
                    hasUpperCase
                      ? "text-emerald-600 font-bold"
                      : "text-slate-400"
                  }
                >
                  {hasUpperCase ? "✓ " : ""}
                  One upper case
                </span>

                <span
                  className={
                    hasSpecialChar
                      ? "text-emerald-600 font-bold"
                      : "text-slate-400"
                  }
                >
                  {hasSpecialChar ? "✓ " : ""}
                  One special character
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="role"
                className="block text-xs font-bold text-slate-900 mb-1"
              >
                Role
              </label>

              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={!!inviteToken}
                className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-700 cursor-pointer disabled:bg-slate-200"
              >
                <option value="Tenant">Tenant</option>
                <option value="Landlord / Realtor">
                  Landlord / Realtor / Agent
                </option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-800 hover:bg-purple-900 text-white font-bold text-base py-3.5 rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating account..." : "Submit"}
              </button>

              <p className="text-xs text-slate-500 text-center mt-3">
                Your information will be used to create your HomeCompa account.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
