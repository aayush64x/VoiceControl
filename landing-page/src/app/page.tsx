import { Footer } from "@/components/Footer";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { ProblemSection } from "@/components/ProblemSection";
import { PricingSection, TeamSection } from "@/components/ReservedSections";
import { SolutionSection } from "@/components/SolutionSection";
import { TechnologySection } from "@/components/TechnologySection";
import { UserInterfaceSection } from "@/components/UserInterfaceSection";

export default function Home() {
  return (
    <>
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <UserInterfaceSection />
        <TechnologySection />
        <PricingSection />
        <TeamSection />
      </main>
      <Footer />
    </>
  );
}
