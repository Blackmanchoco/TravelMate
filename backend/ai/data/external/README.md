# External dataset inventory

Inventory date: 2026-09-16 09:46:58 +08:00 (Asia/Kuala_Lumpur)

## Download capability

- `kaggle` CLI: not installed.
- `~/.kaggle/kaggle.json`: not present.
- `KAGGLE_USERNAME`, `KAGGLE_KEY`, and `KAGGLE_CONFIG_DIR`: not configured.
- A direct public Kaggle API request from the local environment was blocked by network policy, and permission to retry outside the sandbox was not granted.
- No dataset files were downloaded. This directory therefore contains only this inventory; it does not contain a substitute or third-party mirror presented as Kaggle source data.

Existing `training_data_v2.csv` baseline: 30 rows, 2 users, 15 places, 3 destinations.

## Candidate datasets

### 1. Indonesia Tourism Destination — preferred interaction dataset

- Source: https://www.kaggle.com/datasets/aprabowo/indonesia-tourism-destination
- Download status: not downloaded.
- Published contents: four CSV files, approximately 488.93 KB in total.
- Scale: 10,000 user-place ratings, 300 users, 437 places, and 100 tourism packages.
- Interaction file: `tourism_rating.csv`
  - `User_Id` (integer)
  - `Place_Id` (integer)
  - `Place_Ratings` (integer, 1-5 in published examples)
- Place file: `tourism_with_id.csv`
  - `Place_Id` (integer)
  - `Place_Name` (string)
  - `Description` (string)
  - `Category` (string)
  - `City` (string)
  - `Price` (integer)
  - `Rating` (float)
  - `Time_Minutes` (float/nullable)
  - `Coordinate` (string)
  - `Lat`, `Long` (float)
- User file: `user.csv`
  - `User_Id` (integer)
  - `Location` (string)
  - `Age` (integer)
- Mapping to TravelMate:
  - `User_Id -> user_id`
  - `Place_Id -> external place_id`, joined to the place metadata file
  - `Place_Ratings -> explicit interaction label/score`
  - place name/category/city/coordinates/rating map well to `Place` and the descriptive columns in `training_data_v2.csv`
  - `Price` needs conversion to TravelMate's ordinal `price_level`
  - no travel-style, interests, tags, activity tags, transportation, duration, or dietary fields; those columns cannot be truthfully copied from this dataset and would require omission, a separate derivation policy, or a different model feature set
- License/terms shown by the publisher: described as free to use, with credit requested to the GetLoc team and no warranty. No standard SPDX/Creative Commons identifier was visible in the accessible metadata, so exact redistribution terms must be rechecked from the downloaded Kaggle metadata before use in the thesis artifact.

### 2. Travel Recommendation Dataset (India)

- Source: https://www.kaggle.com/datasets/amanmehra23/travel-recommendation-dataset
- Download status: not downloaded.
- Published contents: four CSV files, approximately 177.7 KB total:
  - `Expanded_Destinations.csv`
  - `Final_Updated_Expanded_Reviews.csv`
  - `Final_Updated_Expanded_UserHistory.csv`
  - `Final_Updated_Expanded_Users.csv`
- Semantic fields advertised by the publisher:
  - destinations: identifier, destination type/category, popularity, best time to visit
  - users: user identifier, preferences and demographics, gender, adults and children
  - reviews: user/destination linkage, review and rating
  - user history: destinations visited and ratings
- Scale: the public page does not expose reliable row, unique-user, or unique-destination counts; only file sizes and 23 columns across the dataset are visible. Exact counts and exact column names require downloading the original files.
- Mapping to TravelMate: potentially strong because it appears to contain both user preferences and explicit user-destination interactions. Destination-level records would need to be treated separately from TravelMate's place-level records, and preference values would need vocabulary normalization.
- License warning: the page is internally inconsistent. Its usage text says free for non-commercial use and asks users to contact the provider for commercial use, while other page metadata mentions CC0 and MIT. Do not merge until the downloaded package/metadata resolves the applicable terms.

### 3. Restaurant & Consumer Data — strong contextual fallback

- Primary source: https://archive.ics.uci.edu/dataset/232/restaurant%2Bconsumer%2Bdata
- Kaggle mirror: https://www.kaggle.com/datasets/uciml/restaurant-data-with-consumer-ratings
- Download status: not downloaded.
- Scale: 138 users, 130 restaurants, 1,161 user-item rating rows; nine files total.
- Core interaction fields in `rating_final.csv`:
  - `userID`, `placeID` (nominal/string identifiers)
  - `rating`, `food_rating`, `service_rating` (numeric 0-2)
- Useful place fields in `geoplaces2.csv`: place ID, latitude, longitude, name, address, city, state, country, price tier, ambience, accessibility and service attributes.
- Useful preference fields: user cuisine preferences, transport, ambience, interest, activity and budget tier.
- Mapping to TravelMate: excellent user-item interaction shape and useful budget/transport/context fields. Ratings require rescaling from 0-2. Cuisine-heavy categories do not cover general attractions, and user interest values are not equivalent to TravelMate travel interests.
- License: CC BY 4.0 at the UCI primary source; attribution required. DOI: https://doi.org/10.24432/C5DP41

### 4. Travel Review Rating Dataset — category preference only

- Kaggle source: https://www.kaggle.com/datasets/wirachleelakiatiwong/travel-review-rating-dataset
- Download status: not downloaded.
- Published file: `google_review_ratings.csv`, approximately 637 KB.
- Scale: commonly documented as 5,456 user rows; one user identifier plus 24 numeric category-average ratings.
- Fields: user ID and average ratings for churches, resorts, beaches, parks, theatres, museums, malls, zoos, restaurants, pubs/bars, local services, fast food, hotels/lodgings, juice bars, galleries, clubs, pools, gyms, bakeries, spas, cafes, viewpoints, monuments and gardens.
- Interaction type: no individual POI/item identifier. Each row is a user profile of category-level average ratings rather than user-place events.
- Mapping to TravelMate: category ratings could help derive synthetic `interests` or category preferences, but cannot directly populate `place_id` or train the current user-place ranking target without manufacturing item-level interactions.
- License: the accessible Kaggle metadata did not expose a definitive license. Verify before reuse.

### 5. Tourist Places in Malaysia with Coordinates — place catalog only

- Source: https://www.kaggle.com/datasets/shimisys/tourist-places-in-malaysia-with-coordinates
- Download status: not downloaded.
- Published contents: one 6.07 KB CSV with five columns.
- Scale and exact column names: not exposed by the accessible public page; must be verified from the original CSV.
- Interaction type: none advertised. It appears to be a pure Malaysia POI/coordinate catalog.
- Mapping to TravelMate: potentially useful for expanding `Place` names and coordinates, but likely requires category, description, tags, activity types, rating and price enrichment. It does not solve the user-interaction shortage by itself.
- License: explicitly shown as unknown. Do not merge into a thesis dataset until permission/provenance is clarified.

### 6. Worldwide Travel Cities (Ratings and Climate) — content enrichment only

- Source: https://www.kaggle.com/datasets/furkanima/worldwide-travel-cities-ratings-and-climate
- Download status: not downloaded.
- Scale: 560 cities.
- Fields: city, country, region, coordinates, description, monthly climate data, ideal duration, budget level, and 0-5 thematic ratings for culture, adventure, nature, beaches, nightlife, cuisine, wellness and urban experience.
- Interaction type: no user-item interactions; thematic ratings describe cities.
- Mapping to TravelMate: budget level and thematic ratings align with `budget`, `travel_style` and interest dimensions, but the unit is city/destination rather than place. Useful as content-side augmentation, not as the main training expansion.
- License: MIT.

## Recommendation

1. Use **Indonesia Tourism Destination** as the first dataset to evaluate after download. It changes the interaction scale from 30 to 10,000 rows and has a clean user-place-rating join plus POI metadata.
2. Consider **Restaurant & Consumer Data** as a secondary experiment for preference-aware/contextual features, kept as a separate source domain rather than blindly concatenated.
3. Inspect **Travel Recommendation Dataset (India)** after original-file download because it may offer the closest combined preference/history structure, but its counts, exact schema and conflicting license statements are unresolved.
4. Do not use Malaysia Coordinates, Worldwide Cities, or Travel Review Ratings as the primary solution to interaction scarcity; they are content or category-profile datasets, not direct user-POI ratings.

No transformation, merge, replacement or model training has been performed.
