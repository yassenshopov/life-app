import { Pricing } from '@/components/landing/Pricing';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { FAQ } from '@/components/landing/FAQ';
import { Outfit } from 'next/font/google';
import { Features } from '@/components/landing/Features';

const outfit = Outfit({ subsets: ['latin'] });

export default function PricingPage() {
  return (
    <>
      <Header outfit={outfit} hideAction />
      <main className="min-h-screen pt-20">
        <div className="container mx-auto">
          {/* Hero section */}
          <div className="py-16 text-center">
            <h1 className={`${outfit.className} text-4xl font-bold sm:text-5xl`}>
              Simple, Transparent Pricing
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-300">
              Choose the perfect plan for your needs. No hidden fees.
            </p>
          </div>

          {/* Pricing component */}
          <Pricing outfit={outfit} />

          {/* Features component */}
          <Features outfit={outfit} />

          {/* FAQ component */}
          <FAQ outfit={outfit} />
        </div>
      </main>
      <Footer outfit={outfit} />
    </>
  );
} 