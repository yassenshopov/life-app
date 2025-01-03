'use client';

export function Pricing() {
  return (
    <section className="py-24 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-2xl mx-auto mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-gray-900 dark:text-white">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Choose the perfect plan for your needs. No hidden fees.
          </p>
        </div>
        <div className="flex flex-wrap items-stretch -mx-4">
          {/* Free Tier */}
          <div className="w-full px-4 mb-8 md:w-1/3">
            <div className="h-full p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
              <h3 className="mb-4 text-xl font-bold">Free</h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">Perfect for getting started</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-gray-600 dark:text-gray-400">/month</span>
              </div>
              <ul className="mb-6 space-y-4">
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Basic features
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Up to 1,000 messages/month
                </li>
              </ul>
              <button className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-600">
                Get Started
              </button>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="w-full px-4 mb-8 md:w-1/3">
            <div className="h-full p-8 bg-blue-50 dark:bg-blue-900 rounded-lg shadow-lg">
              <h3 className="mb-4 text-xl font-bold">Pro</h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">For growing businesses</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-gray-600 dark:text-gray-400">/month</span>
              </div>
              <ul className="mb-6 space-y-4">
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  All Free features
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Up to 10,000 messages/month
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Priority support
                </li>
              </ul>
              <button className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-600">
                Start Pro Trial
              </button>
            </div>
          </div>

          {/* Enterprise Tier */}
          <div className="w-full px-4 mb-8 md:w-1/3">
            <div className="h-full p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
              <h3 className="mb-4 text-xl font-bold">Enterprise</h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">For large organizations</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <ul className="mb-6 space-y-4">
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  All Pro features
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Unlimited messages
                </li>
                <li className="flex items-center">
                  <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  24/7 dedicated support
                </li>
              </ul>
              <button className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-600">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 