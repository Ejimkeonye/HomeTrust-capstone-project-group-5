import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";
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

  // Dynamic Password Validation Rules
  const hasEightChars = formData.password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(formData.password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);
  const isValidEmail = /\S+@\S+\.\S+/.test(formData.email);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMessage("Please fill in your full name.");
      return;
    }
    if (!isValidEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!hasEightChars || !hasUpperCase || !hasSpecialChar) {
      setErrorMessage("Password does not meet all strength criteria.");
      return;
    }

    const cleanEmail = formData.email.trim().toLowerCase();
    const fullName = `${formData.firstName.trim()}${formData.lastName.trim()}`;
    const backendRole = formData.role.toLowerCase().includes("landlord") ? "Landlord" : "Tenant";

    try {
      setIsLoading(true);

      const response = await api.post("/auth/register", {
        name: fullName,
        email: cleanEmail,
        password: formData.password,
        role: backendRole,
        phoneNumber: formData.phone.trim(),
      });

      const { token, ...userData } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(userData));

      const sessionData = {
        ...userData,
        token,
      };

      const triggerSuccess = onSuccess || onAuthSuccess;
      if (triggerSuccess) {
        triggerSuccess(sessionData);
      }
    } catch (error) {
      console.error("Registration error:", error);
      const errorMsg = error.response?.data?.message || "Registration failed. Please check your network or details.";
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center sm:p-8 p-4 font-sans">
      <div className="w-full max-w-md md:max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 flex flex-col">
        {/* Header Bar */}
        <div className="bg-purple-800 text-white p-5 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 2 ? () => setStep(1) : onBack}
            className="w-8 h-8 rounded-full border border-purple-400 flex items-center justify-center hover:bg-purple-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-xl font-bold tracking-wide">Create account</h1>
          <div className="w-8"></div>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Step 1: Personal Details */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                First name
              </label>
              <input
                type="text"
                name="firstName"
                required
                placeholder="Clement"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Last name
              </label>
              <input
                type="text"
                name="lastName"
                required
                placeholder="John"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Email address
              </label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  required
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
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Phone number
              </label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="0704536589"
                value={formData.phone}
                onChange={handleChange}
                className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700"
              />
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
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-slate-100/80 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-700 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Dynamic Rules Indicators */}
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold mt-2">
                <span
                  className={
                    hasEightChars
                      ? "text-emerald-600 font-bold"
                      : "text-slate-400"
                  }
                >
                  Must contain 8 characters
                </span>
                <span
                  className={
                    hasUpperCase
                      ? "text-emerald-600 font-bold"
                      : "text-slate-400"
                  }
                >
                  One upper case
                </span>
                <span
                  className={
                    hasSpecialChar
                      ? "text-emerald-600 font-bold"
                      : "text-slate-400"
                  }
                >
                  One special character
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Role
              </label>
              <select
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
                className="w-full bg-purple-800 hover:bg-purple-900 text-white font-bold text-base py-3.5 rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "Creating account..." : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}