import { Link } from "react-router-dom";

const sectionClass = "rounded-panel border border-line bg-surface p-5 shadow-panel sm:p-7";
const headingClass = "text-xl font-semibold text-fg sm:text-2xl";
const bodyClass = "mt-3 text-sm leading-7 text-muted sm:text-base";

function PrivacyNotice() {
  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">TravelMate</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Privacy Notice</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted sm:text-lg">
          This notice explains what information TravelMate stores and how the demonstration system uses it.
        </p>
      </header>

      <div className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
        <section aria-labelledby="privacy-who-we-are" className={sectionClass}>
          <h2 id="privacy-who-we-are" className={headingClass}>Who we are</h2>
          <p className={bodyClass}>
            TravelMate is a final-year project for INTI International College Penang, course 6001CEM, by Goay Wei Jun.
            It is a demonstration system and is not a commercial service. Contact: <span className="font-semibold text-fg">travelmate@gmail.com</span>.
          </p>
        </section>

        <section aria-labelledby="privacy-what-we-collect" className={sectionClass}>
          <h2 id="privacy-what-we-collect" className={headingClass}>What we collect</h2>
          <p className={bodyClass}>
            Your browser sends account and travel information to the configured TravelMate API server when you use these features; the server address depends on deployment configuration. TravelMate stores the following records in its project database:
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-muted sm:text-base">
            <li>
              <strong className="text-fg">Account details:</strong> your name and email address; your password is stored only as a bcrypt hash, never in clear text; and an optional avatar image URL. The account record also has an ID, role, and creation and update timestamps.
            </li>
            <li>
              <strong className="text-fg">Travel preferences:</strong> budget, travel style, interests, preferred activities, dietary preferences, preferred transportation, and trip duration.
            </li>
            <li>
              <strong className="text-fg">Saved places and itineraries:</strong> the places you save and itinerary details such as destination, title, dates, budget, status, planned stops, day, time and order. Itinerary items may include the free-text notes you type and an estimated duration.
            </li>
            <li>
              <strong className="text-fg">Administrator audit records:</strong> for administrator accounts, catalogue-change actions and related target details, optional metadata, and timestamps.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-ai-assistant" className={sectionClass}>
          <h2 id="privacy-ai-assistant" className={headingClass}>AI assistant</h2>
          <p className={bodyClass}>
            For each request, your message and recent conversation messages selected for context are sent to the Ollama language model at the endpoint configured for the project. The default endpoint is local to the backend host at 127.0.0.1:11434, but the project operator can configure a different endpoint.
          </p>
          <p className={bodyClass}>
            If a request looks up catalogue places or uses personalized recommendations, relevant place results may also be sent to Ollama in a follow-up request. Personalized recommendation results are based on your saved preferences.
          </p>
          <p className={bodyClass}>
            The app does not save chat messages in its database or browser storage. Chat stays in the current page session. Do not type sensitive personal information into the chat.
          </p>
        </section>

        <section aria-labelledby="privacy-external-services" className={sectionClass}>
          <h2 id="privacy-external-services" className={headingClass}>External services</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-muted sm:text-base">
            <li>
              When you view a map, your browser requests map tiles from OpenStreetMap tile servers. Those requests reveal the map area and zoom being viewed and may include ordinary connection details such as your IP address.
            </li>
            <li>
              When an itinerary forecast is requested, the backend sends the selected stop&apos;s latitude and longitude, metric units, and the project&apos;s API credential to OpenWeatherMap. The request does not include your account details or chat messages.
            </li>
            <li>
              Fonts are served from TravelMate&apos;s local app assets. Catalogue photos are also served locally; Wikimedia Commons source pages are linked for photo credits. If you add an avatar URL, your browser loads that image directly from the URL&apos;s host, which may receive your IP address and normal browser request information.
            </li>
          </ul>
        </section>

        <section aria-labelledby="privacy-on-device" className={sectionClass}>
          <h2 id="privacy-on-device" className={headingClass}>On your device</h2>
          <p className={bodyClass}>
            A sign-in token and basic account details, including your account ID, name, email, and role, are kept in your browser&apos;s local storage. The token expires; its saved copy may remain until the app next checks the session or you sign out. Signing out clears the saved session.
          </p>
          <p className={bodyClass}>TravelMate&apos;s application code does not set cookies.</p>
          <p className={bodyClass}>The app does not save chat messages in local storage.</p>
        </section>

        <section aria-labelledby="privacy-your-choices" className={sectionClass}>
          <h2 id="privacy-your-choices" className={headingClass}>Your choices</h2>
          <p className={bodyClass}>
            You can update your profile and travel preferences in Account Settings. The app has no self-service account deletion or data export tool. To request deletion of your account and associated data, contact travelmate@gmail.com.
          </p>
          <p className={bodyClass}>
            <Link to="/account-settings" className="font-semibold text-accent underline underline-offset-4">Open Account Settings</Link>
          </p>
        </section>
      </div>
    </article>
  );
}

export default PrivacyNotice;
