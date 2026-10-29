import { useState } from "react";
import { ArrowLeft, BookOpen, Camera, CheckCircle2, ClipboardCheck, FileText, HelpCircle, Image, PenLine, Scale } from "lucide-react";

const sections = [
  {
    title: "1. Get started",
    icon: CheckCircle2,
    summary: "Set up your account and property workspace.",
    steps: [
      "Create an account or sign in to HomeCompa.",
      "Add the rental property you want to document.",
      "Invite the other party so the landlord and tenant can work from the relevant shared workspace.",
    ],
  },
  {
    title: "2. Complete the Move-In inspection",
    icon: ClipboardCheck,
    summary: "Record the condition of the property at the beginning of the tenancy.",
    steps: [
      "Work through the property room by room and review the listed items.",
      "Choose a condition rating for each item where the inspection form provides one.",
      "Add clear comments describing existing marks, wear, defects or missing items.",
      "Keep descriptions factual and specific so they are useful when the property is reviewed later.",
    ],
  },
  {
    title: "3. Add photographs and evidence",
    icon: Camera,
    summary: "Support observations with useful visual evidence.",
    steps: [
      "Photograph the relevant item or area, including any damage or defect.",
      "Take well-lit, focused photographs and include a wider view when it helps identify the location.",
      "Attach evidence to the relevant inspection item and review it before continuing.",
      "Avoid relying on a photograph alone when a short explanatory comment would add context.",
    ],
  },
  {
    title: "4. Review and sign",
    icon: PenLine,
    summary: "Both parties should review the record before signing.",
    steps: [
      "Open the evidence review and check that the notes, ratings and photographs are accurate.",
      "Ask for any unclear or incomplete observations to be corrected before signing.",
      "Each required party signs the inspection using the signing workflow.",
      "When the backend confirms the required signatures and finalization, the completed inspection becomes read-only.",
    ],
  },
  {
    title: "5. View the inspection report",
    icon: FileText,
    summary: "Use the report as the record of the completed inspection.",
    steps: [
      "Open the inspection report from the dashboard when a saved Move-In inspection is available.",
      "Check the property details, recorded condition, comments, evidence and signatures.",
      "Keep the report and supporting evidence for reference throughout the tenancy.",
    ],
  },
  {
    title: "6. Complete the Move-Out inspection",
    icon: Image,
    summary: "Record the property's condition at the end of the tenancy.",
    steps: [
      "The Move-Out workflow unlocks after both parties have signed the Move-In report.",
      "Inspect the same rooms and items where possible so the records can be compared meaningfully.",
      "Add current condition ratings, photographs and comments, especially where something appears to have changed.",
      "Review and sign the Move-Out record through its own workflow.",
    ],
  },
  {
    title: "7. Understand the comparison",
    icon: Scale,
    summary: "Compare like-for-like evidence rather than relying on memory.",
    steps: [
      "Compare the Move-In and Move-Out photographs for the same item or area.",
      "Read both sets of comments and compare the recorded condition ratings.",
      "Treat any identified difference as a point to review, not automatic proof of who caused it.",
      "AI-assisted comparison is planned for a future release; this guide does not imply that it is currently available.",
    ],
  },
];

const faqs = [
  {
    question: "Why is Move-Out locked?",
    answer: "The current dashboard workflow unlocks Move-Out only after both the landlord and tenant have signed the Move-In report.",
  },
  {
    question: "What makes a useful inspection comment?",
    answer: "Describe what you can observe, where it is, and how extensive it is. For example, note the room and the location of a mark rather than writing only “damage”.",
  },
  {
    question: "What if a photograph does not show the whole issue?",
    answer: "Add another photograph from a different distance or angle and include a clear written note. Keep evidence attached to the most relevant item.",
  },
  {
    question: "Does an AI comparison decide who is responsible for damage?",
    answer: "No. The planned comparison should surface possible differences for people to review. It should not independently decide responsibility or replace the underlying evidence.",
  },
];

export default function HowItWorksPage({ onBack }) {
  const [openSections, setOpenSections] = useState(() => sections.map((_, index) => index === 0));
  const [openFaqs, setOpenFaqs] = useState([]);

  const toggleSection = (index) => {
    setOpenSections((current) =>
      current.map((isOpen, itemIndex) => itemIndex === index ? !isOpen : isOpen),
    );
  };

  const toggleFaq = (index) => {
    setOpenFaqs((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="bg-purple-900 px-6 py-8 text-white sm:px-10">
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </button>
          <div className="flex items-start gap-3">
            <BookOpen className="mt-1 h-7 w-7 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-200">HomeCompa guide</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">How It Works</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-purple-100 sm:text-base">
                A practical guide to recording a rental property's condition, reviewing evidence and completing Move-In and Move-Out inspections.
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-8 px-5 py-7 sm:px-10 sm:py-9">
          <section className="rounded-2xl border border-purple-100 bg-purple-50 p-5">
            <h2 className="text-base font-extrabold text-slate-900">The process at a glance</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              HomeCompa helps the relevant parties create a documented record of a property's condition at the start and end of a tenancy. Photos, comments and condition ratings provide context for reviewing possible changes later.
            </p>
          </section>

          <section aria-labelledby="guide-steps-heading">
            <h2 id="guide-steps-heading" className="mb-4 text-xl font-extrabold text-slate-900">Step-by-step guide</h2>
            <div className="space-y-3">
              {sections.map((section, index) => {
                const Icon = section.icon;
                const isOpen = openSections[index];
                return (
                  <article key={section.title} className="overflow-hidden rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleSection(index)}
                      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 sm:p-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-900">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-slate-900">{section.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">{section.summary}</span>
                      </span>
                      <span className="text-xl font-medium text-purple-900" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
                        <ol className="space-y-3">
                          {section.steps.map((step, stepIndex) => (
                            <li key={step} className="flex gap-3 text-sm leading-6 text-slate-700">
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{stepIndex + 1}</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="faq-heading">
            <div className="mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-purple-900" />
              <h2 id="faq-heading" className="text-xl font-extrabold text-slate-900">Frequently asked questions</h2>
            </div>
            <div className="space-y-2">
              {faqs.map((faq, index) => {
                const isOpen = openFaqs.includes(index);
                return (
                  <article key={faq.question} className="rounded-xl border border-slate-200">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleFaq(index)}
                      className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
                    >
                      <span>{faq.question}</span>
                      <span className="text-lg text-purple-900" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen && <p className="px-4 pb-4 text-sm leading-6 text-slate-600">{faq.answer}</p>}
                  </article>
                );
              })}
            </div>
          </section>

          <footer className="border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">
            This guide describes the current inspection workflow and clearly identifies planned AI comparison as future functionality. Available actions may depend on your account role and the state of the inspection.
          </footer>
        </div>
      </div>
    </main>
  );
}
