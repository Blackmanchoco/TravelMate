import { TimeSlot } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";

const malaysiaDestinations = [
  {
    name: "Kuala Lumpur",
    city: "Kuala Lumpur",
    state: "Wilayah Persekutuan",
    description: "Modern city life, iconic landmarks, and a vibrant food scene.",
    imageUrl: "/images/destinations/kuala-lumpur.jpg",
    latitude: 3.139, 
    longitude: 101.6869,
  },
  {
    name: "Penang",
    city: "George Town",
    state: "Penang",
    description: "Historic streets, local cuisine, and colorful cultural heritage.",
    imageUrl: "/images/destinations/penang.jpg",
    latitude: 5.4141,
    longitude: 100.3292,
  },
  {
    name: "Melaka",
    city: "Melaka City",
    state: "Melaka",
    description: "Heritage architecture, riverside charm, and rich cultural attractions.",
    imageUrl: "/images/destinations/melaka.jpg",
    latitude: 2.1896,
    longitude: 102.2501,
  },
];

const destinationPlaces: Record<
  string,
  Array<{
    name: string;
    category: string;
    description: string;
    address: string;
    latitude: number;
    longitude: number;
    rating: number | null;
    priceLevel: number;
    imageUrl: string | null;
    tags: string[];
    travelStyleTags: string[];
    activityTypes: string[];
  }>
> = {
  "Kuala Lumpur": [
    {
      name: "Petronas Twin Towers",
      category: "Attraction",
      description:
        "Iconic twin towers and skyline views in the heart of the city.",
      address:
        "Kuala Lumpur City Centre, 50088 Kuala Lumpur",
      latitude: 3.1579,
      longitude: 101.7113,
      rating: 4.8,
      priceLevel: 3,
      imageUrl: "/images/places/petronas-twin-towers.jpg",
      tags: [
        "culture",
        "landmark",
        "architecture",
        "skyline",
        "iconic",
      ],
      travelStyleTags: [
        "relaxed",
        "cultural",
        "luxury",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
      ],
    },

    {
      name: "KLCC Park",
      category: "Nature",
      description:
        "Urban park with walking paths and lake views beside the towers.",
      address:
        "Kuala Lumpur City Centre, 50088 Kuala Lumpur",
      latitude: 3.1574,
      longitude: 101.712,
      rating: 4.7,
      priceLevel: 2,
      imageUrl: "/images/places/klcc-park.jpg",
      tags: [
        "park",
        "nature",
        "scenic",
        "urban",
      ],
      travelStyleTags: [
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
        "relaxation",
      ],
    },

    {
      name: "Batu Caves",
      category: "Historical",
      description:
        "Famous limestone cave temple with colorful stairs and cultural significance.",
      address:
        "Gombak, 68100 Batu Caves",
      latitude: 3.237,
      longitude: 101.684,
      rating: 4.6,
      priceLevel: 2,
      imageUrl: "/images/places/batu-caves.jpg",
      tags: [
        "culture",
        "heritage",
        "temple",
        "religious",
      ],
      travelStyleTags: [
        "cultural",
        "adventure",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Bukit Bintang",
      category: "Shopping",
      description:
        "Shopping and nightlife hotspot with local food options and entertainment.",
      address:
        "Bukit Bintang, 55100 Kuala Lumpur",
      latitude: 3.1479,
      longitude: 101.708,
      rating: 4.5,
      priceLevel: 3,
      imageUrl: "/images/places/bukit-bintang.jpg",
      tags: [
        "food",
        "urban",
        "entertainment",
      ],
      travelStyleTags: [
        "relaxed",
        "luxury",
        "family",
      ],
      activityTypes: [
        "shopping",
        "nightlife",
        "walking",
      ],
    },

    {
      name: "Jalan Alor",
      category: "Restaurant",
      description:
        "Famous food street with a wide variety of local Malaysian dishes.",
      address:
        "Jalan Alor, 50200 Kuala Lumpur",
      latitude: 3.1468,
      longitude: 101.7092,
      rating: 4.7,
      priceLevel: 2,
      imageUrl: "/images/places/jalan-alor.jpg",
      tags: [
        "food",
        "street-food",
        "local",
        "urban",
      ],
      travelStyleTags: [
        "relaxed",
        "cultural",
      ],
      activityTypes: [
        "photography",
        "nightlife",
        "walking",
      ],
    },

    {
      name: "Kuala Lumpur Tower",
      category: "Attraction",
      description:
        "A telecommunications tower on Bukit Nanas with observation areas overlooking the Kuala Lumpur skyline.",
      address:
        "2 Jalan Punchak, Off Jalan P. Ramlee, 50250 Kuala Lumpur",
      latitude: 3.1528,
      longitude: 101.7038,
      rating: null,
      priceLevel: 3,
      imageUrl: "/images/places/kuala-lumpur-tower.jpg",
      tags: [
        "culture",
        "landmark",
        "architecture",
        "skyline",
      ],
      travelStyleTags: [
        "cultural",
        "family",
        "luxury",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
      ],
    },

    {
      name: "Merdeka Square",
      category: "Historical",
      description:
        "A historic civic square associated with Malaysia's independence and surrounded by prominent colonial-era architecture.",
      address:
        "Jalan Raja, City Centre, 50050 Kuala Lumpur",
      latitude: 3.1478,
      longitude: 101.6937,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "heritage",
        "colonial",
        "landmark",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Central Market Kuala Lumpur",
      category: "Shopping",
      description:
        "A heritage market featuring Malaysian arts, crafts, souvenirs, and local food near the city centre.",
      address:
        "Jalan Hang Kasturi, City Centre, 50050 Kuala Lumpur",
      latitude: 3.1457,
      longitude: 101.6954,
      rating: null,
      priceLevel: 2,
      imageUrl: "/images/places/central-market-kuala-lumpur.jpg",
      tags: [
        "culture",
        "food",
        "heritage",
        "local",
        "art",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "shopping",
        "walking",
        "sightseeing",
      ],
    },

    {
      name: "National Mosque of Malaysia",
      category: "Culture",
      description:
        "Malaysia's national mosque, recognised for its modernist architecture, courtyards, and distinctive blue roof.",
      address:
        "Jalan Perdana, Tasik Perdana, 50480 Kuala Lumpur",
      latitude: 3.142,
      longitude: 101.6917,
      rating: null,
      priceLevel: 1,
      imageUrl: "/images/places/national-mosque.jpg",
      tags: [
        "culture",
        "religious",
        "mosque",
        "architecture",
        "heritage",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Islamic Arts Museum Malaysia",
      category: "Culture",
      description:
        "A museum presenting Islamic decorative arts, manuscripts, architecture, textiles, and objects from across the world.",
      address:
        "Jalan Lembah Perdana, 50480 Kuala Lumpur",
      latitude: 3.1415,
      longitude: 101.6899,
      rating: null,
      priceLevel: 1,
      imageUrl: "/images/places/islamic-arts-museum.jpg",
      tags: [
        "culture",
        "museum",
        "art",
        "heritage",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Thean Hou Temple",
      category: "Culture",
      description:
        "A prominent Chinese temple complex dedicated to the sea goddess Mazu, with ornate halls and city views.",
      address:
        "65 Persiaran Endah, Taman Persiaran Desa, 50460 Kuala Lumpur",
      latitude: 3.1217,
      longitude: 101.687,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "temple",
        "religious",
        "architecture",
        "heritage",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "National Museum of Malaysia",
      category: "Historical",
      description:
        "Malaysia's national museum, with galleries covering the country's archaeology, kingdoms, colonial era, and modern history.",
      address:
        "Jalan Damansara, 50566 Kuala Lumpur",
      latitude: 3.1379,
      longitude: 101.687,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "museum",
        "history",
        "heritage",
      ],
      travelStyleTags: [
        "cultural",
        "family",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "walking",
      ],
    },
  ],

  "Penang": [
    {
      name: "George Town",
      category: "Culture",
      description:
        "UNESCO heritage district with murals, architecture, and cafés.",
      address:
        "George Town, Penang",
      latitude: 5.4141,
      longitude: 100.3292,
      rating: 4.8,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "culture",
        "food",
        "heritage",
        "street-art",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Penang Hill",
      category: "Nature",
      description:
        "Scenic hilltop destination with views over Penang and a heritage funicular.",
      address:
        "Bukit Bendera, 11300 Penang",
      latitude: 5.4201,
      longitude: 100.2672,
      rating: 4.7,
      priceLevel: 3,
      imageUrl: null,
      tags: [
        "nature",
        "scenic",
        "viewpoint",
      ],
      travelStyleTags: [
        "relaxed",
        "adventure",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "hiking",
        "walking",
      ],
    },

    {
      name: "Kek Lok Si Temple",
      category: "Culture",
      description:
        "One of Southeast Asia's largest Buddhist temples with panoramic views.",
      address:
        "Air Itam, 11500 Penang",
      latitude: 5.3977,
      longitude: 100.2734,
      rating: 4.8,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "temple",
        "heritage",
        "buddhist",
        "culture",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Batu Ferringhi Beach",
      category: "Nature",
      description:
        "Popular beach area known for seaside activities and sunset views.",
      address:
        "Batu Ferringhi, 11100 Penang",
      latitude: 5.4695,
      longitude: 100.2462,
      rating: 4.6,
      priceLevel: 3,
      imageUrl: null,
      tags: [
        "nature",
        "sunset",
        "seaside",
        "scenic",
      ],
      travelStyleTags: [
        "relaxed",
        "family",
        "luxury",
      ],
      activityTypes: [
        "beach",
        "photography",
        "relaxation",
        "walking",
      ],
    },

    {
      name: "Little India",
      category: "Culture",
      description:
        "Vibrant district with colorful streets, stalls, and tasty snacks.",
      address:
        "George Town, Penang",
      latitude: 5.4186,
      longitude: 100.3335,
      rating: 4.5,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "culture",
        "food",
        "heritage",
        "local",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
      ],
      activityTypes: [
        "shopping",
        "photography",
        "walking",
        "sightseeing",
      ],
    },

    {
      name: "Clan Jetties of Penang",
      category: "Culture",
      description:
        "A group of historic waterfront settlements on wooden stilts that preserve part of George Town's living clan heritage.",
      address:
        "Pengkalan Weld, George Town, 10300 Penang",
      latitude: 5.4116,
      longitude: 100.3402,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "heritage",
        "waterfront",
        "local",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Fort Cornwallis",
      category: "Historical",
      description:
        "A star-shaped colonial fort at George Town's Esplanade associated with the early British settlement of Penang.",
      address:
        "Jalan Tun Syed Sheh Barakbah, George Town, 10200 Penang",
      latitude: 5.4204,
      longitude: 100.3439,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "fort",
        "history",
        "heritage",
        "colonial",
      ],
      travelStyleTags: [
        "cultural",
        "family",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Khoo Kongsi",
      category: "Culture",
      description:
        "An ornate Chinese clan house and temple complex known for detailed carvings, courtyards, and community heritage.",
      address:
        "18 Cannon Square, George Town, 10450 Penang",
      latitude: 5.4145,
      longitude: 100.3379,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "heritage",
        "clan-house",
        "temple",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Cheong Fatt Tze - The Blue Mansion",
      category: "Historical",
      description:
        "A restored indigo-blue heritage mansion that reflects the architecture and history of a prominent Straits Chinese household.",
      address:
        "14 Leith Street, George Town, 10200 Penang",
      latitude: 5.4213,
      longitude: 100.3343,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "heritage",
        "mansion",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "luxury",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Pinang Peranakan Mansion",
      category: "Culture",
      description:
        "A museum in a restored mansion presenting Peranakan domestic life, decorative arts, clothing, and antiques.",
      address:
        "29 Church Street, George Town, 10200 Penang",
      latitude: 5.4174,
      longitude: 100.3414,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "museum",
        "peranakan",
        "heritage",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Penang Botanic Gardens",
      category: "Nature",
      description:
        "A public garden in a forested valley with tropical plant collections, shaded paths, and landscaped grounds.",
      address:
        "Jalan Kebun Bunga, George Town, 10350 Penang",
      latitude: 5.438,
      longitude: 100.2905,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "nature",
        "garden",
        "flora",
        "scenic",
      ],
      travelStyleTags: [
        "relaxed",
        "family",
        "adventure",
      ],
      activityTypes: [
        "walking",
        "photography",
        "relaxation",
        "sightseeing",
      ],
    },

    {
      name: "Penang National Park",
      category: "Nature",
      description:
        "A protected coastal rainforest with hiking routes, beaches, wildlife habitats, and access from Teluk Bahang.",
      address:
        "Jalan Hassan Abbas, Teluk Bahang, 11050 Penang",
      latitude: 5.459,
      longitude: 100.207,
      rating: null,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "nature",
        "rainforest",
        "wildlife",
        "coast",
      ],
      travelStyleTags: [
        "adventure",
        "family",
      ],
      activityTypes: [
        "hiking",
        "walking",
        "photography",
        "beach",
        "sightseeing",
      ],
    },
  ],

  "Melaka": [
    {
      name: "Jonker Street",
      category: "Culture",
      description:
        "Heritage street known for antique shops, cafés, and local street food.",
      address:
        "Jonker Walk, 75200 Melaka",
      latitude: 2.1945,
      longitude: 102.2467,
      rating: 4.7,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "culture",
        "food",
        "heritage",
        "street-food",
        "antiques",
        "local",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
      ],
      activityTypes: [
        "shopping",
        "sightseeing",
        "walking",
        "nightlife",
      ],
    },

    {
      name: "A Famosa",
      category: "Historical",
      description:
        "Historic Portuguese fort site with strong cultural heritage value.",
      address:
        "Bandar Hilir, 75000 Melaka",
      latitude: 2.1934,
      longitude: 102.2497,
      rating: 4.5,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "culture",
        "fort",
        "history",
        "heritage",
        "portuguese",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Stadthuys",
      category: "Historical",
      description:
        "Historic Dutch colonial building and museum complex.",
      address:
        "Jalan Kota, 75000 Melaka",
      latitude: 2.191,
      longitude: 102.2487,
      rating: 4.6,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "culture",
        "colonial",
        "history",
        "museum",
        "heritage",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Melaka River",
      category: "Nature",
      description:
        "Riverfront walk with cafés, scenic views, and evening ambiance.",
      address:
        "Melaka River, 75000 Melaka",
      latitude: 2.1898,
      longitude: 102.253,
      rating: 4.4,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "nature",
        "river",
        "scenic",
        "waterfront",
        "evening",
      ],
      travelStyleTags: [
        "relaxed",
        "family",
      ],
      activityTypes: [
        "walking",
        "photography",
        "sightseeing",
        "relaxation",
      ],
    },

    {
      name: "Cheng Hoon Teng Temple",
      category: "Culture",
      description:
        "Historic Chinese temple known for intricate architecture and heritage.",
      address:
        "Jalan Tokong, Melaka",
      latitude: 2.1919,
      longitude: 102.2507,
      rating: 4.7,
      priceLevel: 2,
      imageUrl: null,
      tags: [
        "temple",
        "chinese-heritage",
        "architecture",
        "culture",
        "history",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Christ Church Melaka",
      category: "Historical",
      description:
        "An eighteenth-century Dutch church at the centre of Melaka's red-painted historic square.",
      address:
        "Jalan Gereja, Bandar Hilir, 75000 Melaka",
      latitude: 2.1944,
      longitude: 102.2494,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "heritage",
        "church",
        "colonial",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "St. Paul's Church",
      category: "Historical",
      description:
        "Ruins of a historic hilltop church that reflect Melaka's Portuguese, Dutch, and British colonial periods.",
      address:
        "St. Paul's Hill, Bandar Hilir, 75000 Melaka",
      latitude: 2.192,
      longitude: 102.2495,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "ruins",
        "church",
        "heritage",
        "colonial",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Maritime Museum of Melaka",
      category: "Historical",
      description:
        "A maritime history museum housed partly in a replica of the Portuguese ship Flor de la Mar.",
      address:
        "Jalan Merdeka, Bandar Hilir, 75000 Melaka",
      latitude: 2.1917,
      longitude: 102.2468,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "museum",
        "maritime",
        "history",
        "heritage",
      ],
      travelStyleTags: [
        "cultural",
        "family",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "walking",
        "photography",
      ],
    },

    {
      name: "Baba & Nyonya Heritage Museum",
      category: "Culture",
      description:
        "A preserved Peranakan family home displaying domestic interiors, furniture, and the heritage of Melaka's Baba-Nyonya community.",
      address:
        "48-50 Jalan Tun Tan Cheng Lock, 75200 Melaka",
      latitude: 2.1956,
      longitude: 102.2465,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "museum",
        "peranakan",
        "heritage",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
      ],
    },

    {
      name: "Melaka Sultanate Palace Museum",
      category: "Historical",
      description:
        "A wooden reconstruction inspired by a fifteenth-century Melaka palace, with exhibits on the Malay Sultanate and court culture.",
      address:
        "Jalan Kota, Bandar Hilir, 75000 Melaka",
      latitude: 2.1914,
      longitude: 102.2491,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "museum",
        "royal",
        "history",
        "heritage",
      ],
      travelStyleTags: [
        "cultural",
        "family",
        "relaxed",
      ],
      activityTypes: [
        "sightseeing",
        "walking",
        "photography",
      ],
    },

    {
      name: "Kampung Morten",
      category: "Culture",
      description:
        "A living Malay heritage village beside the Melaka River, known for traditional houses including Villa Sentosa.",
      address:
        "Kampung Morten, 75300 Melaka",
      latitude: 2.2051,
      longitude: 102.2534,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "heritage",
        "village",
        "local",
        "architecture",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "walking",
        "sightseeing",
        "photography",
      ],
    },

    {
      name: "Melaka Straits Mosque",
      category: "Culture",
      description:
        "A waterfront mosque on the artificial Melaka Island, recognised for its Islamic architecture and views across the strait.",
      address:
        "Jalan Pulau Melaka 8, Pulau Melaka, 75000 Melaka",
      latitude: 2.1789,
      longitude: 102.249,
      rating: null,
      priceLevel: 1,
      imageUrl: null,
      tags: [
        "culture",
        "religious",
        "mosque",
        "architecture",
        "waterfront",
      ],
      travelStyleTags: [
        "cultural",
        "relaxed",
        "family",
      ],
      activityTypes: [
        "sightseeing",
        "photography",
        "walking",
        "relaxation",
      ],
    },
  ],
};

async function main() {
  for (const destination of malaysiaDestinations) {
    await prisma.destination.upsert({
      where: { name: destination.name },
      update: {},
      create: destination,
    });
  }

  // Kuching is imported separately; update only its existing image field.
  await prisma.destination.updateMany({
    where: { name: "Kuching" },
    data: { imageUrl: "/images/destinations/kuching.jpg" },
  });

  const user = await prisma.user.upsert({
    where: { email: "seed.owner@example.invalid" },
    update: {},
    create: {
      name: "Demo Traveller",
      email: "seed.owner@example.invalid",
      passwordHash: "seed_only_not_real_hash",
      avatar: null,
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      budget: "Mid-range",
      travelStyle: "Relaxed Luxury",
      interests: ["Culture", "Food", "Nature"],
      preferredActivities: ["Beaches", "Food", "Culture"],
      dietaryPreferences: ["Vegetarian-friendly", "Seafood"],
      preferredTransportation: "Drive",
      tripDuration: "3-4 days",
    },
  });

  const allDestinations = await prisma.destination.findMany();
  for (const destination of allDestinations) {
    const places = destinationPlaces[destination.name] ?? [];
    for (const place of places) {
      await prisma.place.upsert({
        where: {
          destinationId_name: {
            destinationId: destination.id,
            name: place.name,
          },
        },
        update: {
          category: place.category,
          description: place.description,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          rating: place.rating,
          priceLevel: place.priceLevel,
          imageUrl: place.imageUrl,
          tags: place.tags,
          travelStyleTags: place.travelStyleTags,
          activityTypes: place.activityTypes,
        },
        create: {
          destinationId: destination.id,
          ...place,
        },
      });
    }
  }

  const savedPlaceCandidates = await prisma.place.findMany({
    take: 3,
    orderBy: { id: "asc" },
  });

  for (const place of savedPlaceCandidates) {
    await prisma.savedPlace.upsert({
      where: {
        userId_placeId: {
          userId: user.id,
          placeId: place.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        placeId: place.id,
      },
    });
  }

  const itinerary = await prisma.itinerary.upsert({
    where: { id: 1 },
    update: {},
    create: {
      userId: user.id,
      destinationId: allDestinations[0]?.id ?? null,
      title: "Penang Heritage Weekend",
      startDate: new Date("2026-09-10T00:00:00.000Z"),
      endDate: new Date("2026-09-12T00:00:00.000Z"),
      budget: 1200,
      status: "planned",
    },
  });

  const itineraryPlaces = await prisma.place.findMany({
    where: {
      destination: {
        name: "Penang",
      },
    },
    take: 3,
    orderBy: { id: "asc" },
  });

  for (let index = 0; index < itineraryPlaces.length; index += 1) {
    const place = itineraryPlaces[index];
    const timeSlots: TimeSlot[] = ["Morning", "Afternoon", "Evening"];

    await prisma.itineraryItem.upsert({
      where: {
        itineraryId_day_timeSlot_order: {
          itineraryId: itinerary.id,
          day: 1,
          timeSlot: timeSlots[index % timeSlots.length],
          order: index + 1,
        },
      },
      update: {},
      create: {
        itineraryId: itinerary.id,
        placeId: place.id,
        day: 1,
        timeSlot: timeSlots[index % timeSlots.length],
        order: index + 1,
        notes: `Explore ${place.name} on Day 1`,
        estimatedDuration: "2 hours",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
