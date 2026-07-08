import v01 from "@/assets/verses/verse-01.jpg";
import v02 from "@/assets/verses/verse-02.jpg";
import v03 from "@/assets/verses/verse-03.jpg";
import v04 from "@/assets/verses/verse-04.jpg";
import v05 from "@/assets/verses/verse-05.jpg";
import v06 from "@/assets/verses/verse-06.jpg";
import v07 from "@/assets/verses/verse-07.jpg";
import v08 from "@/assets/verses/verse-08.jpg";
import v09 from "@/assets/verses/verse-09.jpg";
import v10 from "@/assets/verses/verse-10.jpg";
import v11 from "@/assets/verses/verse-11.jpg";
import v12 from "@/assets/verses/verse-12.jpg";
import v13 from "@/assets/verses/verse-13.jpg";
import v14 from "@/assets/verses/verse-14.jpg";
import v15 from "@/assets/verses/verse-15.jpg";
import v16 from "@/assets/verses/verse-16.jpg";
import v17 from "@/assets/verses/verse-17.jpg";
import v18 from "@/assets/verses/verse-18.jpg";

export type VerseAccent = "lavender" | "rose" | "amber" | "mint" | "sky";
export type Verse = {
  text: string;
  author: string;
  image: string;
  accent: VerseAccent;
};

export const VERSES: Verse[] = [
  { text: "The wound is the place where the Light enters you.", author: "Rumi", image: v01, accent: "lavender" },
  { text: "You do not have to be good. You only have to let the soft animal of your body love what it loves.", author: "Mary Oliver", image: v02, accent: "mint" },
  { text: "Tears are the silent language of grief.", author: "Voltaire", image: v03, accent: "sky" },
  { text: "Let yourself be silently drawn by the strange pull of what you really love.", author: "Rumi", image: v04, accent: "amber" },
  { text: "I will love the light for it shows me the way, yet I will endure the darkness for it shows me the stars.", author: "Og Mandino", image: v05, accent: "sky" },
  { text: "What you seek is seeking you.", author: "Rumi", image: v06, accent: "lavender" },
  { text: "Hope is the thing with feathers that perches in the soul.", author: "Emily Dickinson", image: v07, accent: "sky" },
  { text: "I have learned, in whatsoever state I am, therewith to be content.", author: "Walt Whitman", image: v08, accent: "amber" },
  { text: "Where there is ruin, there is hope for a treasure.", author: "Rumi", image: v09, accent: "mint" },
  { text: "The moon keeps to its course, and by its very nature, gently influences.", author: "Ming-Dao Deng", image: v10, accent: "amber" },
  { text: "When I let go of what I am, I become what I might be.", author: "Lao Tzu", image: v11, accent: "sky" },
  { text: "Faith is the bird that feels the light when the dawn is still dark.", author: "Rabindranath Tagore", image: v12, accent: "rose" },
  { text: "The quieter you become, the more you are able to hear.", author: "Rumi", image: v13, accent: "sky" },
  { text: "Out beyond ideas of wrongdoing and rightdoing, there is a field. I'll meet you there.", author: "Rumi", image: v14, accent: "lavender" },
  { text: "And the day came when the risk to remain tight in a bud was more painful than the risk it took to blossom.", author: "Anaïs Nin", image: v15, accent: "mint" },
  { text: "I am not what happened to me. I am what I choose to become.", author: "Carl Jung", image: v16, accent: "lavender" },
  { text: "Even after all this time the sun never says to the earth, 'You owe me.'", author: "Hafiz", image: v17, accent: "amber" },
  { text: "You, as much as anybody in the entire universe, deserve your love and affection.", author: "Buddha", image: v18, accent: "lavender" },
  { text: "Wherever you are is the entry point.", author: "Kabir", image: v01, accent: "mint" },
  { text: "Be patient toward all that is unsolved in your heart and try to love the questions themselves.", author: "Rainer Maria Rilke", image: v03, accent: "sky" },
  { text: "Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.", author: "Thich Nhat Hanh", image: v05, accent: "mint" },
  { text: "You have a right to your actions, but never to your actions' fruits.", author: "Bhagavad Gita", image: v07, accent: "amber" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca", image: v09, accent: "sky" },
  { text: "The moon lives in the lining of your skin.", author: "Mirabai", image: v11, accent: "lavender" },
  { text: "Sit quietly, doing nothing. Spring comes, and the grass grows by itself.", author: "Bashō", image: v13, accent: "mint" },
  { text: "Your task is not to seek for love, but merely to seek and find all the barriers within yourself that you have built against it.", author: "Rumi", image: v15, accent: "rose" },
];

export function dailyVerse(): Verse {
  return VERSES[new Date().getDate() % VERSES.length];
}

export function randomVerse(seed?: number): Verse {
  const i = typeof seed === "number" ? seed % VERSES.length : Math.floor(Math.random() * VERSES.length);
  return VERSES[i];
}