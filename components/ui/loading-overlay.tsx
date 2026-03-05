"use client";

import { useState, useEffect, useRef } from "react";

const PHRASES = [
  "Dusting off the history books",
  "Bribing ancient scholars",
  "Asking the local ghosts",
  "Consulting the archives",
  "Digging up the dirt",
  "Rewinding the clock",
  "Interrogating Wikipedia",
  "Waking up the historians",
  "Checking the Roman records",
  "Unrolling the scrolls",
  "Summoning Julius Caesar",
  "Raiding the library of Alexandria",
  "Carbon dating your curiosity",
  "Translating ancient hieroglyphs",
  "Knocking on the crypt door",
  "Pestering the local archaeologist",
  "Polishing the crystal ball",
  "Flipping through the almanac",
  "Chiseling answers from stone tablets",
  "Asking a very old person",
  "Shaking the magic 8-ball of history",
  "Decoding the ancient runes",
  "Whispering to the soil",
  "Excavating the facts",
  "Consulting the oracle",
  "Interviewing a time traveler",
  "Checking the papal records",
  "Lighting the signal fires",
  "Dispatching a carrier pigeon",
  "Rifling through the dead files",
  "Calling the knights of the round table",
  "Reading the tea leaves",
  "Waking the sleeping monks",
  "Sifting through centuries of gossip",
  "Poring over dusty manuscripts",
  "Navigating the catacombs",
  "Peeking into the past",
  "Rewinding the hourglass",
  "Consulting Cleopatra's diary",
  "Translating Latin nobody asked for",
  "Unearthing forgotten legends",
  "Counting the tree rings",
  "Interrogating a fossil",
  "Ringing the village elder",
  "Dredging the river of time",
  "Asking someone who was definitely there",
  "Checking if Napoleon left notes",
  "Comparing conflicting accounts",
  "Finding out what really happened here",
  "Searching the royal treasury",
  "Reading smoke signals from 1642",
  "Patching a hole in the space-time continuum",
  "Locating the long-lost deed",
  "Consulting a monk who took a vow of silence",
  "Reviewing the battle plans",
  "Looking for eyewitnesses — there are none",
  "Asking a very opinionated archivist",
  "Checking if Shakespeare mentioned this place",
  "Deciphering a blurry old map",
  "Waking up a very tired professor",
  "Reading someone's very old diary",
  "Reconstructing the crime scene",
  "Locating the buried treasure first",
  "Persuading a pirate to talk",
  "Googling in ancient Greek",
  "Submitting a formal request to the past",
  "Filing through microfiche",
  "Checking if Columbus took a wrong turn here",
  "Finding out who owned this land in 1347",
  "Asking the ravens",
  "Consulting the stars as ancient people did",
  "Calling in a favor from the Vatican",
  "Reading the graffiti on the aqueduct",
  "Translating a suspicious stone inscription",
  "Fact-checking the myth",
  "Following the breadcrumbs through the centuries",
  "Locating a very specific coin from 800 AD",
  "Debating with a feudal lord",
  "Decoding medieval tax records",
  "Interviewing a retired knight",
  "Reviewing the king's correspondence",
  "Checking the church ledger from 1521",
  "Asking the cartographer nicely",
  "Convincing a samurai to share their notes",
  "Looking for clues in a portrait painting",
  "Untangling centuries of political drama",
  "Persuading a pharaoh's ghost",
  "Listening to what the ruins are saying",
  "Consulting the elder librarian",
  "Verifying the legend against the facts",
  "Piecing together a very old puzzle",
  "Searching for the missing chapter",
  "Finding the footnote nobody reads",
  "Cross-referencing three unreliable sources",
  "Reading a very dramatic historical account",
  "Tracking down a Viking who left no forwarding address",
  "Digging where X marks the spot",
  "Tracing the bloodlines back a thousand years",
  "Asking a gargoyle for directions",
];

export function shufflePhrases(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { PHRASES };

function BouncingDots() {
  return (
    <span className="inline-flex items-end gap-[2px] ml-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-amber-400 animate-bounce inline-block"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

export function LoadingOverlay() {
  const queue = useRef<string[]>(shufflePhrases(PHRASES));
  const indexRef = useRef(0);
  const [text, setText] = useState(() => queue.current[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= queue.current.length) {
        queue.current = shufflePhrases(PHRASES);
        indexRef.current = 0;
      }
      setText(queue.current[indexRef.current]);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-6 inset-x-0 flex justify-center z-20 pointer-events-none px-4">
      <div className="bg-zinc-900/95 border border-zinc-800 rounded-2xl px-5 py-3 backdrop-blur-sm flex items-center gap-3 shadow-xl max-w-sm w-full">
        <span className="text-zinc-200 text-sm font-medium flex items-center">
          {text}
          <BouncingDots />
        </span>
      </div>
    </div>
  );
}
