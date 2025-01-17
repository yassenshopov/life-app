'use client';

import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

const faqs = [
  {
    question: 'How does Frameworked work with my existing Notion setup?',
    answer: 'Frameworked seamlessly integrates with your existing Notion workspace, using it as the source of truth while providing enhanced features and interfaces. There\'s no need to change your current Notion structure.',
  },
  {
    question: 'What kind of modules are available?',
    answer: 'We offer modules for financial tracking, fitness planning, task management, and more. Each module is designed to enhance specific aspects of your Notion workspace with specialized features and visualizations.',
  },
  {
    question: 'Is my Notion data secure?',
    answer: 'Yes, absolutely. We use Notion\'s official API and industry-standard encryption. We never store your sensitive data, and all communications are encrypted.',
  },
  {
    question: 'Can I use Frameworked on mobile?',
    answer: 'Yes! We offer a mobile-optimized interface that makes it easy to input data and manage tasks on the go, providing a faster experience than the native Notion mobile app.',
  },
  {
    question: 'Do you offer custom solutions for teams?',
    answer: 'Yes, our Enterprise plan includes custom module development, dedicated support, and specialized team collaboration features. Contact our sales team to learn more.',
  },
  {
    question: 'Can I switch between different modules?',
    answer: 'Yes, depending on your plan, you can activate or deactivate modules as needed. The Pro plan gives you access to all available modules.',
  },
];

export function FAQ({ outfit }: { outfit: any }) {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className={`${outfit.className} text-base font-semibold leading-7 text-indigo-600`}>FAQ</h2>
          <p className={`${outfit.className} mt-2 text-3xl font-bold tracking-tight sm:text-4xl`}>
            Common questions
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Everything you need to know about Frameworked and how it works with Notion.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl">
          <dl className="space-y-4">
            {faqs.map((faq) => (
              <Disclosure as="div" key={faq.question} className="pt-4">
                {({ open }) => (
                  <>
                    <dt>
                      <Disclosure.Button className="flex w-full items-start justify-between text-left">
                        <span className={`${outfit.className} text-base font-semibold leading-7`}>{faq.question}</span>
                        <span className="ml-6 flex h-7 items-center">
                          <ChevronDownIcon
                            className={`h-6 w-6 ${open ? '-rotate-180' : 'rotate-0'} transform transition-transform duration-200`}
                          />
                        </span>
                      </Disclosure.Button>
                    </dt>
                    <Disclosure.Panel as="dd" className="mt-2 pr-12">
                      <p className="text-base leading-7 text-gray-600 dark:text-gray-300">{faq.answer}</p>
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
} 