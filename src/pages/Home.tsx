import Hero from "../components/hero/Hero";

import PopularDestinations from "../components/destinations/PopularDestinations";

import AITravelAssistant from "../components/ai/AITravelAssistant";

import RecommendedPlaces from "../components/destinations/RecommendedPlaces";

function Home() {
  return (
    <>

      {/* Hero */}
      <Hero />

      {/* Popular Destinations */}
      <PopularDestinations />

      {/* AI Travel Assistant */}
      <AITravelAssistant />

      {/* Recommended Places */}
      <RecommendedPlaces />

    </>
  );
}

export default Home;
