'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "What is your product?",
    answer: "Our product is a comprehensive solution that helps businesses streamline their operations and improve efficiency."
  },
  {
    question: "How does pricing work?",
    answer: "We offer flexible pricing plans starting from free tier up to enterprise solutions. Choose the plan that best fits your needs."
  },
  {
    question: "Do you offer support?",
    answer: "Yes, we provide customer support for all our plans. Enterprise customers get access to 24/7 dedicated support."
  },
  {
    question: "Can I cancel my subscription?",
    answer: "Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-gray-50 dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-2xl mx-auto mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Have questions? We're here to help.
          </p>
        </div>
        <div className="max-w-3xl mx-auto">
          {faqItems.map((item, index) => (
            <div key={index} className="mb-4">
              <button
                className="flex items-center justify-between w-full px-4 py-4 text-left bg-white dark:bg-slate-800 rounded-lg focus:outline-none"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.question}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-500 transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-4 py-3 mt-2 bg-white dark:bg-slate-800 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
} 