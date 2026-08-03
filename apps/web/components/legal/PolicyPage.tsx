"use client"

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Footer from "@/components/footer";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import LandingPageNavbar from "@/components/landingPage/LandingPageNavbar";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";

export type PolicySectionDef = { id: string; title: string };

/**
 * Shell for the long-form legal pages: sticky section nav, scroll spy, back
 * button. /terms and /privacy still carry their own copy of this markup — they
 * can move over whenever someone touches them next.
 */
export function PolicyPage({
  heading,
  intro,
  sections,
  children,
}: {
  heading: string;
  intro?: React.ReactNode;
  sections: PolicySectionDef[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? "");

  useSmoothScroll();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3;
      let currentSection = "";
      sections.forEach((section) => {
        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= scrollPosition) {
          currentSection = section.id;
        }
      });
      setActiveSection(currentSection);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  return (
    <div className="bg-gradient-to-b from-purple-50 to-white text-slate-800 min-h-screen">
      <LandingPageNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-purple-600 transition-colors font-medium mb-16 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back
          </button>

          <h1 className="text-3xl md:text-5xl font-bold text-center mb-16 text-slate-900 w-full">
            {heading}
          </h1>
        </div>

        {intro && (
          <div className="mx-auto mb-12 max-w-3xl rounded-xl border border-purple-200 bg-purple-50/60 p-5 text-sm leading-relaxed text-slate-700">
            {intro}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-12">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 mb-8">
              <ul className="space-y-3">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={cn(
                        "block text-sm transition-colors duration-300",
                        activeSection === section.id
                          ? "text-purple-600 font-semibold"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <main className="lg:col-span-3 space-y-12">{children}</main>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export const PolicySection = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-20">
    <h2 className="text-2xl font-bold text-slate-900 mb-4">{title}</h2>
    <div className="text-slate-600 leading-relaxed space-y-4">{children}</div>
  </section>
);
