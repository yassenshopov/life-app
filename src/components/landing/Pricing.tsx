'use client';

import { CheckIcon } from '@heroicons/react/24/outline';

const tiers = [
  {
    name: 'Basic',
    id: 'tier-basic',
    price: '$9',
    description: 'Perfect for getting started with essential modules.',
    features: [
      'Up to 3 modules of choice',
      'Basic data visualization',
      'Mobile app access',
      'Standard support',
    ],
    featured: false,
  },
  {
    name: 'Pro',
    id: 'tier-pro',
    price: '$19',
    description: 'Everything you need for advanced Notion enhancement.',
    features: [
      'All available modules',
      'Advanced analytics',
      'Priority support',
      'Custom dashboards',
      'API access',
      'Early access to new features',
    ],
    featured: true,
  },
  {
    name: 'Enterprise',
    id: 'tier-enterprise',
    price: 'Custom',
    description: 'Dedicated support and custom solutions for teams.',
    features: [
      'Everything in Pro',
      'Custom module development',
      'Dedicated support',
      'Team collaboration features',
      'Advanced security features',
      'Custom integrations',
    ],
    featured: false,
  },
];

export function Pricing({ outfit }: { outfit: any }) {
  return (
    <div className="py-24 sm:py-32" id="pricing">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center">
          <h2 className={`${outfit.className} text-base font-semibold leading-7 text-indigo-600`}>Pricing</h2>
          <p className={`${outfit.className} mt-2 text-3xl font-bold tracking-tight sm:text-4xl`}>
            Choose your perfect plan
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Start with the modules you need and scale as you grow.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-y-6 sm:mt-20 lg:max-w-none lg:grid-cols-3 lg:gap-x-8">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl p-8 ring-1 ring-gray-200 dark:ring-gray-800 xl:p-10 ${
                tier.featured ? 'bg-indigo-600/5 ring-indigo-600' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-x-4">
                <h3 className={`${outfit.className} text-lg font-semibold leading-8 ${tier.featured ? 'text-indigo-600' : ''}`}>
                  {tier.name}
                </h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{tier.description}</p>
              <p className={`${outfit.className} mt-6 flex items-baseline gap-x-1`}>
                <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                {tier.price !== 'Custom' && <span className="text-sm font-semibold leading-6">/month</span>}
              </p>
              <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <CheckIcon className="h-6 w-5 flex-none text-indigo-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-8 w-full rounded-xl px-3 py-2 text-center text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  tier.featured
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                    : 'bg-white text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300 dark:bg-gray-900'
                }`}
              >
                {tier.name === 'Enterprise' ? 'Contact sales' : 'Get started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 