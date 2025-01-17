import {
  ChartBarIcon,
  DevicePhoneMobileIcon,
  ViewColumnsIcon,
  ArrowPathIcon,
  SparklesIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    name: 'Enhanced Visualizations',
    description: 'Transform your Notion data into beautiful, interactive charts and dashboards.',
    icon: ChartBarIcon,
  },
  {
    name: 'Faster Mobile Experience',
    description: 'Streamlined mobile interface for quick data entry and task management on the go.',
    icon: DevicePhoneMobileIcon,
  },
  {
    name: 'Drag-and-Drop Interface',
    description: 'Intuitive drag-and-drop functionality for easier organization and planning.',
    icon: ViewColumnsIcon,
  },
  {
    name: 'Real-time Integrations',
    description: 'Automatic updates for stocks, fitness data, and more, right in your workspace.',
    icon: ArrowPathIcon,
  },
  {
    name: 'Custom Modules',
    description: 'Choose from a variety of specialized modules for finance, fitness, and productivity.',
    icon: CubeTransparentIcon,
  },
  {
    name: 'AI-Powered Insights',
    description: 'Get smart suggestions and analytics based on your data patterns.',
    icon: SparklesIcon,
  },
];

export function Features({ outfit }: { outfit: any }) {
  return (
    <div id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className={`${outfit.className} text-base font-semibold leading-7 text-indigo-600`}>Everything you need</h2>
          <p className={`${outfit.className} mt-2 text-3xl font-bold tracking-tight sm:text-4xl`}>
            Power features for power users
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            All the tools you need to extend Notion's capabilities while maintaining its simplicity.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="flex flex-col">
                <dt className={`${outfit.className} flex items-center gap-x-3 text-base font-semibold leading-7`}>
                  <feature.icon className="h-5 w-5 flex-none text-indigo-600" aria-hidden="true" />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
