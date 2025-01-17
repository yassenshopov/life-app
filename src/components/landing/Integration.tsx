import { ArrowPathIcon, LockClosedIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

const integrationFeatures = [
  {
    name: 'Seamless Sync',
    description: "Your Notion remains the source of truth. All changes sync automatically in real-time.",
    icon: ArrowPathIcon,
  },
  {
    name: 'Secure Connection',
    description: "Your data is encrypted and secure. We use Notion's official API for all operations.",
    icon: LockClosedIcon,
  },
  {
    name: 'Keep Your Setup',
    description: 'No need to change your Notion structure. We adapt to your existing setup.',
    icon: DocumentDuplicateIcon,
  },
];

export function Integration({ outfit }: { outfit: any }) {
  return (
    <div className="py-24 sm:py-32 bg-gradient-to-b from-transparent via-indigo-50 to-transparent dark:via-indigo-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className={`${outfit.className} text-base font-semibold leading-7 text-indigo-600`}>Seamless Integration</h2>
          <p className={`${outfit.className} mt-2 text-3xl font-bold tracking-tight sm:text-4xl`}>
            Works perfectly with your Notion
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Enhance your Notion experience without changing how you work. Connect once and get instant access to all features.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {integrationFeatures.map((feature) => (
              <div key={feature.name} className="flex flex-col items-center text-center">
                <dt className="flex flex-col items-center gap-y-4">
                  <div className="rounded-lg bg-indigo-600/10 p-4">
                    <feature.icon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                  </div>
                  <span className={`${outfit.className} text-lg font-semibold leading-7`}>{feature.name}</span>
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16 flex justify-center">
          <div className="relative rounded-2xl bg-gray-900/5 dark:bg-gray-100/5 p-8 ring-1 ring-inset ring-gray-900/10 dark:ring-gray-100/10 lg:p-12">
            <div className="text-center">
              <h3 className={`${outfit.className} text-lg font-semibold leading-8`}>
                Ready to get started?
              </h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                Connect your Notion workspace in minutes and start exploring the possibilities.
              </p>
              <button className="mt-8 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
                Connect with Notion
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 