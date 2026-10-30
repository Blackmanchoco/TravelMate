-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('Morning', 'Afternoon', 'Evening');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "budget" TEXT,
    "travelStyle" TEXT,
    "interests" TEXT[],
    "preferredActivities" TEXT[],
    "dietaryPreferences" TEXT[],
    "preferredTransportation" TEXT,
    "tripDuration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" SERIAL NOT NULL,
    "destinationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "rating" DECIMAL(2,1),
    "priceLevel" INTEGER,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_places" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itineraries" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "destinationId" INTEGER,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_items" (
    "id" SERIAL NOT NULL,
    "itineraryId" INTEGER NOT NULL,
    "placeId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "timeSlot" "TimeSlot" NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "estimatedDuration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_name_key" ON "destinations"("name");

-- CreateIndex
CREATE INDEX "destinations_state_idx" ON "destinations"("state");

-- CreateIndex
CREATE INDEX "destinations_city_idx" ON "destinations"("city");

-- CreateIndex
CREATE INDEX "places_destinationId_idx" ON "places"("destinationId");

-- CreateIndex
CREATE INDEX "places_category_idx" ON "places"("category");

-- CreateIndex
CREATE INDEX "places_rating_idx" ON "places"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "places_destinationId_name_key" ON "places"("destinationId", "name");

-- CreateIndex
CREATE INDEX "saved_places_userId_idx" ON "saved_places"("userId");

-- CreateIndex
CREATE INDEX "saved_places_placeId_idx" ON "saved_places"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_places_userId_placeId_key" ON "saved_places"("userId", "placeId");

-- CreateIndex
CREATE INDEX "itineraries_userId_idx" ON "itineraries"("userId");

-- CreateIndex
CREATE INDEX "itineraries_destinationId_idx" ON "itineraries"("destinationId");

-- CreateIndex
CREATE INDEX "itinerary_items_itineraryId_day_timeSlot_order_idx" ON "itinerary_items"("itineraryId", "day", "timeSlot", "order");

-- CreateIndex
CREATE INDEX "itinerary_items_placeId_idx" ON "itinerary_items"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_items_itineraryId_day_timeSlot_order_key" ON "itinerary_items"("itineraryId", "day", "timeSlot", "order");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "places" ADD CONSTRAINT "places_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_places" ADD CONSTRAINT "saved_places_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
