import { useState, useMemo } from "react";
import { Plus, ChevronDown, ChevronUp, Zap, Search, BookOpen } from "lucide-react";

interface Shoe {
  id: string;
  name: string;
  brand: string;
  hasCarbonPlate: boolean;
  stackHeight: number;
  speedBenefitPercent: number;
  tier: "supershoe" | "racer" | "trainer";
  isCustom?: boolean;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

const BUILT_IN_SHOES: Shoe[] = [
  { id: "alphafly-3", name: "Alphafly 3", brand: "Nike", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 4.2, tier: "supershoe" },
  { id: "vaporfly-3", name: "Vaporfly 3", brand: "Nike", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 4.0, tier: "supershoe" },
  { id: "alphafly-2", name: "Alphafly 2", brand: "Nike", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 4.0, tier: "supershoe" },
  { id: "vaporfly-2", name: "Vaporfly 2", brand: "Nike", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 3.8, tier: "supershoe" },
  { id: "streakfly-2", name: "Streakfly 2", brand: "Nike", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 2.8, tier: "racer" },
  { id: "streakfly", name: "Streakfly", brand: "Nike", hasCarbonPlate: false, stackHeight: 27, speedBenefitPercent: 2.5, tier: "racer" },
  { id: "zoom-fly-6", name: "Zoom Fly 6", brand: "Nike", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.0, tier: "racer" },
  { id: "zoom-fly-5", name: "Zoom Fly 5", brand: "Nike", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 1.9, tier: "racer" },
  { id: "pegasus-premium", name: "Pegasus Premium", brand: "Nike", hasCarbonPlate: false, stackHeight: 38, speedBenefitPercent: 1.3, tier: "trainer" },
  { id: "pegasus-41", name: "Pegasus 41", brand: "Nike", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "pegasus-40", name: "Pegasus 40", brand: "Nike", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "vomero-18", name: "Vomero 18", brand: "Nike", hasCarbonPlate: false, stackHeight: 40, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "structure-18", name: "Structure 18", brand: "Nike", hasCarbonPlate: false, stackHeight: 31, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "invincible-3", name: "Invincible 3", brand: "Nike", hasCarbonPlate: false, stackHeight: 39, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "infinityrun-4", name: "InfinityRun 4", brand: "Nike", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "ultrafly", name: "Ultrafly", brand: "Nike", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 1.8, tier: "racer" },
  { id: "reactx-miler", name: "ReactX Miler", brand: "Nike", hasCarbonPlate: false, stackHeight: 31, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "winflo-12", name: "Winflo 12", brand: "Nike", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "pegasus-trail-5", name: "Pegasus Trail 5", brand: "Nike", hasCarbonPlate: false, stackHeight: 31, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "free-rn-5", name: "Free RN 5.0 Next Nature", brand: "Nike", hasCarbonPlate: false, stackHeight: 22, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "air-zoom-tempo", name: "Air Zoom Tempo Next%", brand: "Nike", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 1.5, tier: "trainer" },
  { id: "adios-pro-4", name: "Adios Pro 4", brand: "Adidas", hasCarbonPlate: true, stackHeight: 50, speedBenefitPercent: 3.8, tier: "supershoe" },
  { id: "adios-pro-evo-2", name: "Adios Pro Evo 2", brand: "Adidas", hasCarbonPlate: true, stackHeight: 39, speedBenefitPercent: 4.2, tier: "supershoe" },
  { id: "adios-pro-evo-1", name: "Adios Pro Evo 1", brand: "Adidas", hasCarbonPlate: true, stackHeight: 39, speedBenefitPercent: 4.1, tier: "supershoe" },
  { id: "adios-pro-3", name: "Adios Pro 3", brand: "Adidas", hasCarbonPlate: true, stackHeight: 39, speedBenefitPercent: 3.6, tier: "supershoe" },
  { id: "prime-x-2-strung", name: "Prime X 2 Strung", brand: "Adidas", hasCarbonPlate: true, stackHeight: 50, speedBenefitPercent: 3.7, tier: "supershoe" },
  { id: "takumi-sen-10", name: "Takumi Sen 10", brand: "Adidas", hasCarbonPlate: true, stackHeight: 33, speedBenefitPercent: 2.7, tier: "racer" },
  { id: "takumi-sen-9", name: "Takumi Sen 9", brand: "Adidas", hasCarbonPlate: true, stackHeight: 33, speedBenefitPercent: 2.6, tier: "racer" },
  { id: "evo-sl", name: "EVO SL", brand: "Adidas", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 2.2, tier: "racer" },
  { id: "boston-13", name: "Boston 13", brand: "Adidas", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 1.5, tier: "trainer" },
  { id: "boston-12", name: "Boston 12", brand: "Adidas", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 1.4, tier: "trainer" },
  { id: "adizero-sl2", name: "Adizero SL2", brand: "Adidas", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "supernova-stride", name: "Supernova Stride", brand: "Adidas", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "supernova-rise-3", name: "Supernova Rise 3", brand: "Adidas", hasCarbonPlate: false, stackHeight: 38, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "ultraboost-light", name: "Ultraboost Light", brand: "Adidas", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "ultraboost-5", name: "Ultraboost 5", brand: "Adidas", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "solar-glide-7", name: "Solar Glide 7", brand: "Adidas", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "solar-boost-6", name: "Solar Boost 6", brand: "Adidas", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "duramo-speed", name: "Duramo Speed", brand: "Adidas", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "adistar-3", name: "Adistar 3", brand: "Adidas", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "adizero-boston-12", name: "Adizero Boston 12", brand: "Adidas", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 1.4, tier: "trainer" },
  { id: "adizero-sl", name: "Adizero SL", brand: "Adidas", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "metaspeed-sky-paris", name: "Metaspeed Sky Paris", brand: "ASICS", hasCarbonPlate: true, stackHeight: 41, speedBenefitPercent: 3.7, tier: "supershoe" },
  { id: "metaspeed-edge-paris", name: "Metaspeed Edge Paris", brand: "ASICS", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.7, tier: "supershoe" },
  { id: "metaspeed-sky-tokyo", name: "Metaspeed Sky Tokyo", brand: "ASICS", hasCarbonPlate: true, stackHeight: 39, speedBenefitPercent: 3.5, tier: "supershoe" },
  { id: "metaspeed-edge-tokyo", name: "Metaspeed Edge Tokyo", brand: "ASICS", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 3.5, tier: "supershoe" },
  { id: "metaspeed-ray", name: "Metaspeed Ray", brand: "ASICS", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 3.2, tier: "supershoe" },
  { id: "magic-speed-4", name: "Magic Speed 4", brand: "ASICS", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 2.4, tier: "racer" },
  { id: "magic-speed-3", name: "Magic Speed 3", brand: "ASICS", hasCarbonPlate: true, stackHeight: 34, speedBenefitPercent: 2.2, tier: "racer" },
  { id: "superblast-2", name: "Superblast 2", brand: "ASICS", hasCarbonPlate: false, stackHeight: 45, speedBenefitPercent: 1.6, tier: "trainer" },
  { id: "superblast", name: "Superblast", brand: "ASICS", hasCarbonPlate: false, stackHeight: 45, speedBenefitPercent: 1.5, tier: "trainer" },
  { id: "novablast-5", name: "Novablast 5", brand: "ASICS", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "novablast-4", name: "Novablast 4", brand: "ASICS", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "dynablast-4", name: "Dynablast 4", brand: "ASICS", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "evoride-speed-2", name: "EvoRide Speed 2", brand: "ASICS", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "gel-cumulus-27", name: "Gel Cumulus 27", brand: "ASICS", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "gel-nimbus-27", name: "Gel Nimbus 27", brand: "ASICS", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "gel-kayano-32", name: "Gel Kayano 32", brand: "ASICS", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "gt-2000-13", name: "GT-2000 13", brand: "ASICS", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "noosa-tri-16", name: "Noosa Tri 16", brand: "ASICS", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 1.2, tier: "trainer" },
  { id: "gel-kayano-31", name: "Gel Kayano 31", brand: "ASICS", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "gt-1000-13", name: "GT-1000 13", brand: "ASICS", hasCarbonPlate: false, stackHeight: 27, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "sc-elite-v5", name: "SC Elite v5", brand: "New Balance", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 3.9, tier: "supershoe" },
  { id: "sc-elite-v4", name: "SC Elite v4", brand: "New Balance", hasCarbonPlate: true, stackHeight: 39, speedBenefitPercent: 3.7, tier: "supershoe" },
  { id: "fuelcell-sc-pacer-v2", name: "FuelCell SC Pacer v2", brand: "New Balance", hasCarbonPlate: true, stackHeight: 34, speedBenefitPercent: 2.5, tier: "racer" },
  { id: "fuelcell-sc-pacer-v1", name: "FuelCell SC Pacer v1", brand: "New Balance", hasCarbonPlate: true, stackHeight: 34, speedBenefitPercent: 2.4, tier: "racer" },
  { id: "supercomp-trainer-v3", name: "SuperComp Trainer v3", brand: "New Balance", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 2.0, tier: "racer" },
  { id: "supercomp-trainer-v2", name: "SuperComp Trainer v2", brand: "New Balance", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 1.9, tier: "racer" },
  { id: "fuelcell-rebel-v5", name: "FuelCell Rebel v5", brand: "New Balance", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 1.3, tier: "trainer" },
  { id: "fuelcell-rebel-v4", name: "FuelCell Rebel v4", brand: "New Balance", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 1.2, tier: "trainer" },
  { id: "fuelcell-propel-v5", name: "FuelCell Propel v5", brand: "New Balance", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "880-v15", name: "880 v15", brand: "New Balance", hasCarbonPlate: false, stackHeight: 31, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "fresh-foam-1080-v14", name: "Fresh Foam 1080 v14", brand: "New Balance", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "fresh-foam-more-v6", name: "Fresh Foam More v6", brand: "New Balance", hasCarbonPlate: false, stackHeight: 42, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "fresh-foam-vongo-v6", name: "Fresh Foam Vongo v6", brand: "New Balance", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "fuelcell-walker-elite", name: "FuelCell Walker Elite", brand: "New Balance", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "fresh-foam-x-880v14", name: "Fresh Foam X 880 v14", brand: "New Balance", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "rocket-x-3", name: "Rocket X 3", brand: "Hoka", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.5, tier: "racer" },
  { id: "rocket-x-2", name: "Rocket X 2", brand: "Hoka", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 2.3, tier: "racer" },
  { id: "cielo-x1", name: "Cielo X1", brand: "Hoka", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.2, tier: "supershoe" },
  { id: "carbon-x-3", name: "Carbon X 3", brand: "Hoka", hasCarbonPlate: true, stackHeight: 33, speedBenefitPercent: 2.0, tier: "racer" },
  { id: "mach-x", name: "Mach X", brand: "Hoka", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 1.8, tier: "racer" },
  { id: "mach-6", name: "Mach 6", brand: "Hoka", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "mach-5", name: "Mach 5", brand: "Hoka", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "kawana-2", name: "Kawana 2", brand: "Hoka", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "rincon-4", name: "Rincon 4", brand: "Hoka", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "clifton-10", name: "Clifton 10", brand: "Hoka", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "clifton-9", name: "Clifton 9", brand: "Hoka", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "bondi-9", name: "Bondi 9", brand: "Hoka", hasCarbonPlate: false, stackHeight: 40, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "arahi-7", name: "Arahi 7", brand: "Hoka", hasCarbonPlate: false, stackHeight: 31, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "speedgoat-6", name: "Speedgoat 6", brand: "Hoka", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "challenger-8", name: "Challenger 8", brand: "Hoka", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "transport-hoka", name: "Transport", brand: "Hoka", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "mach-supercomp-trainer", name: "Mach SuperComp Trainer", brand: "Hoka", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 1.9, tier: "racer" },
  { id: "endorphin-elite-2", name: "Endorphin Elite 2", brand: "Saucony", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 4.0, tier: "supershoe" },
  { id: "endorphin-elite", name: "Endorphin Elite", brand: "Saucony", hasCarbonPlate: true, stackHeight: 39, speedBenefitPercent: 3.8, tier: "supershoe" },
  { id: "endorphin-pro-4", name: "Endorphin Pro 4", brand: "Saucony", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 2.6, tier: "racer" },
  { id: "endorphin-pro-3", name: "Endorphin Pro 3", brand: "Saucony", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 2.5, tier: "racer" },
  { id: "endorphin-speed-5", name: "Endorphin Speed 5", brand: "Saucony", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 1.7, tier: "trainer" },
  { id: "endorphin-speed-4", name: "Endorphin Speed 4", brand: "Saucony", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 1.6, tier: "trainer" },
  { id: "endorphin-shift-4", name: "Endorphin Shift 4", brand: "Saucony", hasCarbonPlate: false, stackHeight: 38, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "kinvara-15", name: "Kinvara 15", brand: "Saucony", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "kinvara-14", name: "Kinvara 14", brand: "Saucony", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "ride-18", name: "Ride 18", brand: "Saucony", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "triumph-22", name: "Triumph 22", brand: "Saucony", hasCarbonPlate: false, stackHeight: 37, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "guide-18", name: "Guide 18", brand: "Saucony", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "tempus-2", name: "Tempus 2", brand: "Saucony", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "peregrine-14", name: "Peregrine 14", brand: "Saucony", hasCarbonPlate: false, stackHeight: 26, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "xodus-ultra-3", name: "Xodus Ultra 3", brand: "Saucony", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "cohesion-16", name: "Cohesion 16", brand: "Saucony", hasCarbonPlate: false, stackHeight: 26, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "hyperion-elite-5", name: "Hyperion Elite 5", brand: "Brooks", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.7, tier: "racer" },
  { id: "hyperion-elite-4", name: "Hyperion Elite 4", brand: "Brooks", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.5, tier: "racer" },
  { id: "hyperion-max-3", name: "Hyperion Max 3", brand: "Brooks", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 1.4, tier: "trainer" },
  { id: "hyperion-tempo-2", name: "Hyperion Tempo 2", brand: "Brooks", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 1.2, tier: "trainer" },
  { id: "launch-12", name: "Launch 12", brand: "Brooks", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "levitate-7", name: "Levitate 7", brand: "Brooks", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "ghost-17", name: "Ghost 17", brand: "Brooks", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "glycerin-21", name: "Glycerin 21", brand: "Brooks", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "adrenaline-gts-25", name: "Adrenaline GTS 25", brand: "Brooks", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "caldera-7", name: "Caldera 7", brand: "Brooks", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "hyperion-3", name: "Hyperion 3", brand: "Brooks", hasCarbonPlate: false, stackHeight: 26, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "glycerin-gts-21", name: "Glycerin GTS 21", brand: "Brooks", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "fast-r-nitro-elite-3", name: "Fast-R Nitro Elite 3", brand: "Puma", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 4.1, tier: "supershoe" },
  { id: "fast-r-nitro-elite-2", name: "Fast-R Nitro Elite 2", brand: "Puma", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 4.0, tier: "supershoe" },
  { id: "deviate-nitro-elite-3", name: "Deviate Nitro Elite 3", brand: "Puma", hasCarbonPlate: true, stackHeight: 42, speedBenefitPercent: 3.6, tier: "supershoe" },
  { id: "deviate-nitro-elite-2", name: "Deviate Nitro Elite 2", brand: "Puma", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 3.4, tier: "supershoe" },
  { id: "deviate-nitro-4", name: "Deviate Nitro 4", brand: "Puma", hasCarbonPlate: true, stackHeight: 37, speedBenefitPercent: 2.4, tier: "racer" },
  { id: "deviate-nitro-3", name: "Deviate Nitro 3", brand: "Puma", hasCarbonPlate: true, stackHeight: 37, speedBenefitPercent: 2.3, tier: "racer" },
  { id: "velocity-nitro-4", name: "Velocity Nitro 4", brand: "Puma", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "magnify-nitro-3", name: "Magnify Nitro 3", brand: "Puma", hasCarbonPlate: false, stackHeight: 38, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "electrify-nitro-3", name: "Electrify Nitro 3", brand: "Puma", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "foreverrun-nitro-2", name: "ForeverRun Nitro 2", brand: "Puma", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "cloudboom-strike-ls", name: "Cloudboom Strike LS", brand: "On", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 3.1, tier: "supershoe" },
  { id: "cloudboom-echo-3", name: "Cloudboom Echo 3", brand: "On", hasCarbonPlate: true, stackHeight: 34, speedBenefitPercent: 2.8, tier: "racer" },
  { id: "cloudboom-echo-2", name: "Cloudboom Echo 2", brand: "On", hasCarbonPlate: true, stackHeight: 34, speedBenefitPercent: 2.6, tier: "racer" },
  { id: "cloudmonster-hyper", name: "Cloudmonster Hyper", brand: "On", hasCarbonPlate: false, stackHeight: 42, speedBenefitPercent: 1.2, tier: "trainer" },
  { id: "cloudmonster-2", name: "Cloudmonster 2", brand: "On", hasCarbonPlate: false, stackHeight: 40, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "cloudsurfer-2", name: "Cloudsurfer 2", brand: "On", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "cloudflow-4", name: "Cloudflow 4", brand: "On", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "cloudrunner-2", name: "Cloudrunner 2", brand: "On", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "cloudstratus-4", name: "Cloudstratus 4", brand: "On", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "wave-rebellion-pro-3", name: "Wave Rebellion Pro 3", brand: "Mizuno", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.9, tier: "racer" },
  { id: "wave-rebellion-pro-2", name: "Wave Rebellion Pro 2", brand: "Mizuno", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.7, tier: "racer" },
  { id: "wave-rebellion-flash-3", name: "Wave Rebellion Flash 3", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 1.6, tier: "trainer" },
  { id: "wave-rebellion-flash-2", name: "Wave Rebellion Flash 2", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 1.5, tier: "trainer" },
  { id: "wave-neo-wind", name: "Wave Neo Wind", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "wave-neo-vista", name: "Wave Neo Vista", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "duel-sonic-3", name: "Duel Sonic 3", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "wave-rider-29", name: "Wave Rider 29", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "wave-sky-7", name: "Wave Sky 7", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 0.4, tier: "trainer" },
  { id: "wave-inspire-21", name: "Wave Inspire 21", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "wave-aero-22", name: "Wave Aero 22", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 24, speedBenefitPercent: 1.2, tier: "trainer" },
  { id: "wave-shadow-7", name: "Wave Shadow 7", brand: "Mizuno", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "vanish-carbon-2", name: "Vanish Carbon 2", brand: "Altra", hasCarbonPlate: true, stackHeight: 30, speedBenefitPercent: 2.8, tier: "racer" },
  { id: "vanish-carbon", name: "Vanish Carbon", brand: "Altra", hasCarbonPlate: true, stackHeight: 30, speedBenefitPercent: 2.6, tier: "racer" },
  { id: "escalante-racer-2", name: "Escalante Racer 2", brand: "Altra", hasCarbonPlate: false, stackHeight: 24, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "escalante-4", name: "Escalante 4", brand: "Altra", hasCarbonPlate: false, stackHeight: 24, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "torin-8", name: "Torin 8", brand: "Altra", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "rivera-4", name: "Rivera 4", brand: "Altra", hasCarbonPlate: false, stackHeight: 25, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "provision-8", name: "Provision 8", brand: "Altra", hasCarbonPlate: false, stackHeight: 27, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "slab-phantasm-3", name: "S/Lab Phantasm 3", brand: "Salomon", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.9, tier: "racer" },
  { id: "slab-phantasm-2", name: "S/Lab Phantasm 2", brand: "Salomon", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.7, tier: "racer" },
  { id: "aero-volt-2", name: "Aero Volt 2", brand: "Salomon", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 1.2, tier: "trainer" },
  { id: "aero-blaze", name: "Aero Blaze", brand: "Salomon", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "spectur", name: "Spectur", brand: "Salomon", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "glide-max-tr", name: "Glide Max TR", brand: "Salomon", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "ultra-glide-2", name: "Ultra Glide 2", brand: "Salomon", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "infinite-elite-2", name: "Infinite Elite 2", brand: "Under Armour", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.4, tier: "racer" },
  { id: "infinite-pro", name: "Infinite Pro", brand: "Under Armour", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "machina-4", name: "Machina 4", brand: "Under Armour", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "phantom-4", name: "Phantom 4", brand: "Under Armour", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "velociti-4", name: "Velociti 4", brand: "Under Armour", hasCarbonPlate: false, stackHeight: 27, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "floatride-energy-x", name: "Floatride Energy X", brand: "Reebok", hasCarbonPlate: true, stackHeight: 33, speedBenefitPercent: 2.2, tier: "racer" },
  { id: "floatride-energy-5", name: "Floatride Energy 5", brand: "Reebok", hasCarbonPlate: false, stackHeight: 29, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "floatride-run-fast-4", name: "Floatride Run Fast 4", brand: "Reebok", hasCarbonPlate: false, stackHeight: 26, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "ctm-ultra-carbon-3", name: "CTM Ultra Carbon 3", brand: "Craft", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.0, tier: "supershoe" },
  { id: "ctm-ultra-3", name: "CTM Ultra 3", brand: "Craft", hasCarbonPlate: false, stackHeight: 36, speedBenefitPercent: 1.2, tier: "trainer" },
  { id: "nordlite-speed", name: "Nordlite Speed", brand: "Craft", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.9, tier: "trainer" },
  { id: "fusion-40", name: "Fusion 4.0", brand: "Karhu", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "ikoni-20", name: "Ikoni 2.0", brand: "Karhu", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "synchron-ortix-4", name: "Synchron Ortix 4", brand: "Karhu", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.3, tier: "trainer" },
  { id: "flame-4", name: "Flame 4", brand: "361 Degrees", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.0, tier: "supershoe" },
  { id: "futura-361", name: "Futura", brand: "361 Degrees", hasCarbonPlate: false, stackHeight: 34, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "fierce-361", name: "Fierce", brand: "361 Degrees", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "feidian-4-ultra", name: "Feidian 4 Ultra", brand: "Li-Ning", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 4.0, tier: "supershoe" },
  { id: "feidian-4-elite", name: "Feidian 4 Elite", brand: "Li-Ning", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.5, tier: "supershoe" },
  { id: "superlight-3", name: "Superlight 3", brand: "Li-Ning", hasCarbonPlate: false, stackHeight: 26, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "160x-5-pro", name: "160X 5.0 Pro", brand: "Xtep", hasCarbonPlate: true, stackHeight: 40, speedBenefitPercent: 3.8, tier: "supershoe" },
  { id: "160x-5", name: "160X 5.0", brand: "Xtep", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.2, tier: "supershoe" },
  { id: "atomo-v7000", name: "Atomo v7000", brand: "Diadora", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.2, tier: "racer" },
  { id: "equipe-corsa", name: "Equipe Corsa", brand: "Diadora", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.8, tier: "trainer" },
  { id: "trailfly-ultra-g-300-max", name: "Trailfly Ultra G 300 Max", brand: "Inov-8", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 2.2, tier: "racer" },
  { id: "trailfly-g-270-v2", name: "Trailfly G 270 V2", brand: "Inov-8", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.5, tier: "trainer" },
  { id: "roadfly-g-380", name: "Roadfly G 380", brand: "Inov-8", hasCarbonPlate: true, stackHeight: 34, speedBenefitPercent: 2.4, tier: "racer" },
  { id: "pursuit-carbon", name: "Pursuit Carbon", brand: "Scott", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.8, tier: "racer" },
  { id: "speed-elite", name: "Speed Elite", brand: "Scott", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 1.1, tier: "trainer" },
  { id: "kinabalu-rc", name: "Kinabalu RC", brand: "Scott", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "go-run-race-4", name: "Go Run Race 4", brand: "Skechers", hasCarbonPlate: true, stackHeight: 36, speedBenefitPercent: 2.5, tier: "racer" },
  { id: "go-run-speed-elite", name: "Go Run Speed Elite", brand: "Skechers", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 1.0, tier: "trainer" },
  { id: "go-run-max-road-6", name: "Go Run Max Road 6", brand: "Skechers", hasCarbonPlate: false, stackHeight: 33, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "norda-001", name: "001", brand: "Norda", hasCarbonPlate: false, stackHeight: 28, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "norda-002", name: "002", brand: "Norda", hasCarbonPlate: false, stackHeight: 30, speedBenefitPercent: 0.6, tier: "trainer" },
  { id: "peak-marathon-elite", name: "Marathon Elite", brand: "PEAK", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.4, tier: "supershoe" },
  { id: "peak-speed-carbon", name: "Speed Carbon", brand: "PEAK", hasCarbonPlate: true, stackHeight: 35, speedBenefitPercent: 2.6, tier: "racer" },
  { id: "kiprun-kd900x", name: "Kiprun KD900X", brand: "Kalenji", hasCarbonPlate: true, stackHeight: 38, speedBenefitPercent: 3.0, tier: "supershoe" },
  { id: "kiprun-kd900", name: "Kiprun KD900", brand: "Kalenji", hasCarbonPlate: false, stackHeight: 35, speedBenefitPercent: 1.3, tier: "trainer" },
  { id: "topo-cyclone-3", name: "Cyclone 3", brand: "Topo Athletic", hasCarbonPlate: true, stackHeight: 33, speedBenefitPercent: 2.3, tier: "racer" },
  { id: "topo-ultrafly-5", name: "Ultrafly 5", brand: "Topo Athletic", hasCarbonPlate: false, stackHeight: 32, speedBenefitPercent: 0.7, tier: "trainer" },
  { id: "topo-fli-lyte-5", name: "Fli-Lyte 5", brand: "Topo Athletic", hasCarbonPlate: false, stackHeight: 25, speedBenefitPercent: 0.8, tier: "trainer" },
];

const PRESET_DISTANCES: { label: string; km: number }[] = [
  { label: "5K", km: 5 },
  { label: "10K", km: 10 },
  { label: "Half Marathon", km: 21.0975 },
  { label: "Marathon", km: 42.195 },
  { label: "Ultra (50K)", km: 50 },
];

function formatTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return "--:--";
  const s = Math.round(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${String(hours)}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

function estimateBenefit(hasCarbonPlate: boolean, stackHeight: number): number {
  if (hasCarbonPlate && stackHeight >= 35) return 3.5;
  if (hasCarbonPlate && stackHeight < 35) return 2.5;
  if (!hasCarbonPlate && stackHeight >= 35) return 1.2;
  return 0.8;
}

interface ShoeResult {
  shoe: Shoe;
  timeSaved: number;
  projectedTime: number;
}

interface CompareState {
  shoeAId: string | null;
  shoeBId: string | null;
}

export default function ShoeCalculator() {
  const [selectedDistanceKm, setSelectedDistanceKm] = useState<number | null>(null);
  const [customDistanceStr, setCustomDistanceStr] = useState("");
  const [paceMinutes, setPaceMinutes] = useState("");
  const [paceSeconds, setPaceSeconds] = useState("");
  const [shoes, setShoes] = useState<Shoe[]>(BUILT_IN_SHOES);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customCarbon, setCustomCarbon] = useState(false);
  const [customStack, setCustomStack] = useState("");
  const [customBenefit, setCustomBenefit] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compare, setCompare] = useState<CompareState>({ shoeAId: null, shoeBId: null });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [selectedTier, setSelectedTier] = useState<"all" | "supershoe" | "racer" | "trainer">("all");
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); }, 3000);
  };

  const distanceKm: number | null = (() => {
    if (selectedDistanceKm !== null) return selectedDistanceKm;
    const parsed = parseFloat(customDistanceStr);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return null;
  })();

  const paceTotalSeconds: number | null = (() => {
    const mins = parseInt(paceMinutes, 10);
    const secs = parseInt(paceSeconds, 10);
    if (isNaN(mins) || isNaN(secs)) return null;
    if (mins < 0 || secs < 0 || secs >= 60) return null;
    const total = mins * 60 + secs;
    if (total <= 0) return null;
    return total;
  })();

  const originalTimeSeconds: number | null = (() => {
    if (distanceKm === null || paceTotalSeconds === null) return null;
    return distanceKm * paceTotalSeconds;
  })();

  const allBrands = useMemo(() => {
    const brands = new Set<string>();
    shoes.forEach((s) => { brands.add(s.brand); });
    return Array.from(brands).sort();
  }, [shoes]);

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  const filteredShoes = useMemo(() => {
    return shoes.filter((shoe) => {
      if (searchQuery.trim() !== "" && !shoe.name.toLowerCase().includes(searchQuery.toLowerCase()) && !shoe.brand.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedBrands.size > 0 && !selectedBrands.has(shoe.brand)) {
        return false;
      }
      if (selectedTier !== "all" && shoe.tier !== selectedTier) {
        return false;
      }
      return true;
    });
  }, [shoes, searchQuery, selectedBrands, selectedTier]);

  const results: ShoeResult[] = (() => {
    if (originalTimeSeconds === null) return [];
    return filteredShoes
      .map((shoe) => {
        const benefit = shoe.speedBenefitPercent;
        const timeSaved = originalTimeSeconds * (benefit / (100 + benefit));
        const projectedTime = originalTimeSeconds - timeSaved;
        return { shoe, timeSaved, projectedTime };
      })
      .sort((a, b) => b.timeSaved - a.timeSaved);
  })();

  const handleAddCustomShoe = () => {
    if (customName.trim() === "") {
      showToast("Shoe name is required", "error");
      return;
    }
    const stackVal = parseInt(customStack, 10);
    if (isNaN(stackVal) || stackVal <= 0) {
      showToast("Enter a valid stack height", "error");
      return;
    }

    let benefit: number;
    const parsedBenefit = parseFloat(customBenefit);
    if (!isNaN(parsedBenefit) && parsedBenefit > 0) {
      benefit = parsedBenefit;
    } else {
      benefit = estimateBenefit(customCarbon, stackVal);
    }

    const tier: "supershoe" | "racer" | "trainer" =
      benefit >= 3.5 ? "supershoe" : benefit >= 2.0 ? "racer" : "trainer";

    const newShoe: Shoe = {
      id: `custom-${String(Date.now())}`,
      name: customName.trim(),
      brand: customBrand.trim() || "Custom",
      hasCarbonPlate: customCarbon,
      stackHeight: stackVal,
      speedBenefitPercent: benefit,
      tier,
      isCustom: true,
    };

    setShoes((prev) => [...prev, newShoe]);
    setCustomName("");
    setCustomBrand("");
    setCustomCarbon(false);
    setCustomStack("");
    setCustomBenefit("");
    setShowCustomForm(false);
    showToast(`${newShoe.name} added`, "success");
  };

  const getTierStyle = (tier: "supershoe" | "racer" | "trainer"): React.CSSProperties => {
    if (tier === "supershoe") return { color: "var(--accent)", background: "var(--accent-dim)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 };
    if (tier === "racer") return { color: "var(--warning)", background: "#451a03", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 };
    return { color: "var(--text-muted)", background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 };
  };

  const tierLabel = (tier: "supershoe" | "racer" | "trainer") => {
    if (tier === "supershoe") return "Supershoe";
    if (tier === "racer") return "Racer";
    return "Trainer";
  };

  const compareResultA = compare.shoeAId !== null ? results.find((r) => r.shoe.id === compare.shoeAId) : null;
  const compareResultB = compare.shoeBId !== null ? results.find((r) => r.shoe.id === compare.shoeBId) : null;

  const tierFilterOptions: { label: string; value: "all" | "supershoe" | "racer" | "trainer" }[] = [
    { label: "All Tiers", value: "all" },
    { label: "Supershoe", value: "supershoe" },
    { label: "Racer", value: "racer" },
    { label: "Trainer", value: "trainer" },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px", background: "var(--bg-primary)" }}>
      {toast !== null && (
        <div
          className={`toast toast-${toast.type}`}
          style={{ position: "fixed", top: 24, right: 24, zIndex: 1000 }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Shoe Speed Calculator</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            How much faster will you finish with each shoe?
          </p>
        </div>

        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Race Setup</h2>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Distance</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRESET_DISTANCES.map((d) => (
                <button
                  key={d.km}
                  type="button"
                  className={selectedDistanceKm === d.km ? "btn-primary" : "btn-secondary"}
                  style={{ fontSize: 13, padding: "6px 12px" }}
                  onClick={() => {
                    setSelectedDistanceKm(d.km);
                    setCustomDistanceStr("");
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="0.1"
                step="0.1"
                placeholder="Custom km"
                value={customDistanceStr}
                onChange={(e) => {
                  setCustomDistanceStr(e.target.value);
                  setSelectedDistanceKm(null);
                }}
                style={{
                  width: 120,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>km</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>Pace (min:sec per km)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="min"
                value={paceMinutes}
                onChange={(e) => { setPaceMinutes(e.target.value); }}
                style={{
                  width: 72,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "6px 10px",
                  fontSize: 13,
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 16, color: "var(--text-secondary)", fontWeight: 700 }}>:</span>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="sec"
                value={paceSeconds}
                onChange={(e) => { setPaceSeconds(e.target.value); }}
                style={{
                  width: 72,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "6px 10px",
                  fontSize: 13,
                  textAlign: "center",
                }}
              />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>/km</span>
            </div>
          </div>

          {originalTimeSeconds !== null && (
            <div style={{
              background: "var(--bg-tertiary)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Baseline finish time:</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {formatTime(originalTimeSeconds)}
              </span>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "0 0 auto" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search shoes..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); }}
                style={{
                  width: 220,
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text-primary)",
                  padding: "7px 10px 7px 30px",
                  fontSize: 13,
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {tierFilterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={selectedTier === opt.value ? "btn-primary" : "btn-secondary"}
                  style={{ fontSize: 12, padding: "5px 10px" }}
                  onClick={() => { setSelectedTier(opt.value); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
              Showing {filteredShoes.length} of {shoes.length} shoes
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allBrands.map((brand) => {
              const isActive = selectedBrands.has(brand);
              return (
                <button
                  key={brand}
                  type="button"
                  onClick={() => { toggleBrand(brand); }}
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    borderRadius: 12,
                    border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                    background: isActive ? "var(--accent-dim)" : "var(--bg-tertiary)",
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {brand}
                </button>
              );
            })}
            {selectedBrands.size > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedBrands(new Set()); }}
                style={{
                  fontSize: 11,
                  padding: "3px 9px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className={compareMode ? "btn-primary" : "btn-secondary"}
              style={{ fontSize: 13, padding: "6px 12px" }}
              onClick={() => {
                setCompareMode((v) => !v);
                setCompare({ shoeAId: null, shoeBId: null });
              }}
            >
              Compare Shoes
            </button>
            {compareMode && (
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Select two shoes from the table to compare
              </span>
            )}
          </div>
        )}

        {compareMode && (compareResultA !== null || compareResultB !== null) && (
          <div className="card" style={{ marginBottom: 16, padding: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[compareResultA, compareResultB].map((r, idx) => (
              <div key={idx} style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Shoe {String.fromCharCode(65 + idx)}</div>
                {r !== null && r !== undefined ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{r.shoe.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.shoe.brand}</div>
                    <div style={{ fontSize: 14, color: "var(--success)", marginTop: 6 }}>
                      -{formatTime(r.timeSaved)} saved
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
                      Finish: {formatTime(r.projectedTime)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Not selected</div>
                )}
              </div>
            ))}
            {compareResultA !== null && compareResultA !== undefined && compareResultB !== null && compareResultB !== undefined && (
              <div style={{ flex: 1, minWidth: 160, borderLeft: "1px solid var(--border)", paddingLeft: 20 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Difference</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>
                  {formatTime(Math.abs(compareResultA.timeSaved - compareResultB.timeSaved))}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {compareResultA.timeSaved > compareResultB.timeSaved
                    ? `${compareResultA.shoe.name} is faster`
                    : `${compareResultB.shoe.name} is faster`}
                </div>
              </div>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="card" style={{ marginBottom: 20, overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                Results — {results.length} shoes
              </h2>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "16%" }} />
                  {compareMode && <col style={{ width: "6%" }} />}
                </colgroup>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    {["Shoe", "Tier", "Carbon", "Benefit", "Time Saved", "Finish Time"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                    {compareMode && (
                      <th style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>
                        Pick
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const isSelectedForCompare = compare.shoeAId === r.shoe.id || compare.shoeBId === r.shoe.id;
                    return (
                      <tr
                        key={r.shoe.id}
                        style={{
                          background: isSelectedForCompare ? "var(--bg-hover)" : i % 2 === 0 ? "var(--bg-primary)" : "var(--bg-secondary)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                                {r.shoe.name}
                                {r.shoe.isCustom === true && (
                                  <span style={{ marginLeft: 6, fontSize: 10, color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 5px", borderRadius: 3 }}>
                                    custom
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.shoe.brand}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={getTierStyle(r.shoe.tier)}>{tierLabel(r.shoe.tier)}</span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {r.shoe.hasCarbonPlate ? (
                            <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>Yes</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {r.shoe.speedBenefitPercent.toFixed(1)}%
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                          -{formatTime(r.timeSaved)}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                          {formatTime(r.projectedTime)}
                        </td>
                        {compareMode && (
                          <td style={{ padding: "10px 16px" }}>
                            <button
                              type="button"
                              className={isSelectedForCompare ? "btn-primary" : "btn-secondary"}
                              style={{ fontSize: 11, padding: "3px 8px" }}
                              onClick={() => {
                                setCompare((prev) => {
                                  if (prev.shoeAId === r.shoe.id) return { ...prev, shoeAId: null };
                                  if (prev.shoeBId === r.shoe.id) return { ...prev, shoeBId: null };
                                  if (prev.shoeAId === null) return { ...prev, shoeAId: r.shoe.id };
                                  if (prev.shoeBId === null) return { ...prev, shoeBId: r.shoe.id };
                                  return prev;
                                });
                              }}
                            >
                              {isSelectedForCompare ? "Remove" : "Add"}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {originalTimeSeconds === null && (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", marginBottom: 20 }}>
            <Zap size={32} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
            <div style={{ fontSize: 14 }}>Enter a distance and pace above to see shoe comparisons</div>
          </div>
        )}

        {originalTimeSeconds !== null && results.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", marginBottom: 20 }}>
            <div style={{ fontSize: 14 }}>No shoes match your current filters</div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 24, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => { setShowCustomForm((v) => !v); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "16px 20px",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <Plus size={16} style={{ color: "var(--accent)" }} />
            Add Custom Shoe
            <span style={{ marginLeft: "auto" }}>
              {showCustomForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showCustomForm && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
              <div style={{ paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Shoe Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My Custom Racer"
                    value={customName}
                    onChange={(e) => { setCustomName(e.target.value); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Brooks"
                    value={customBrand}
                    onChange={(e) => { setCustomBrand(e.target.value); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Stack Height (mm) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="80"
                    placeholder="e.g. 36"
                    value={customStack}
                    onChange={(e) => { setCustomStack(e.target.value); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Speed Benefit %{" "}
                    <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>(optional — auto-estimated)</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    placeholder="e.g. 3.5"
                    value={customBenefit}
                    onChange={(e) => { setCustomBenefit(e.target.value); }}
                    style={{
                      width: "100%",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      padding: "8px 10px",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={customCarbon}
                    onChange={(e) => { setCustomCarbon(e.target.checked); }}
                    style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                  />
                  Carbon plate
                </label>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                Auto-estimate guide: carbon + stack &ge;35mm &rarr; 3.5% &bull; carbon + stack &lt;35mm &rarr; 2.5% &bull; no carbon + stack &ge;35mm &rarr; 1.2% &bull; no carbon + stack &lt;35mm &rarr; 0.8%
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAddCustomShoe}
                >
                  Add Shoe
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 24, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => { setShowHowItWorks((v) => !v); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "16px 20px",
              color: "var(--text-primary)",
              fontSize: 15,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            <BookOpen size={16} style={{ color: "var(--accent)" }} />
            How It Works
            <span style={{ marginLeft: "auto" }}>
              {showHowItWorks ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>

          {showHowItWorks && (
            <div style={{ padding: "0 24px 24px", borderTop: "1px solid var(--border)" }}>

              <div style={{ paddingTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Speed Benefit Percentage
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  Each shoe in this calculator has a speed benefit percentage representing how much faster you would finish
                  a race compared to running in a basic, non-technical shoe. These values are derived from published
                  biomechanics research and lab-tested shoe data. A 4% benefit means you would finish approximately
                  4% faster — roughly 7 minutes saved on a 3-hour marathon.
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  The Science
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.6 }}>
                  The landmark 2017 University of Colorado study (Hoogkamer et al.) found Nike Vaporfly shoes improved
                  running economy by approximately 4% on average, with individual responses ranging from 1.6% to 6.3%.
                  A 2026 meta-analysis of 14 studies covering 271 runners (Kobayashi et al.) confirmed that carbon-plated
                  shoes reduce the metabolic cost of running by 2 to 3% on average.
                </p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  The benefits come from three factors working together: advanced PEBA foam (ZoomX, LightStrike Pro,
                  PWRRUN HG) with 80-87% energy return versus 60-65% for standard EVA foam; a stiff carbon fiber plate
                  that acts as a lever to propel the foot forward; and a rocker geometry that promotes an efficient
                  forward rolling motion through the gait cycle.
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  How We Calculate
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.6 }}>
                  Time saved is calculated as:
                </p>
                <div style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "10px 14px",
                  fontFamily: "monospace",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}>
                  time_saved = baseline_time &times; (benefit% / (100 + benefit%))
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
                  This formula accounts for the fact that a faster pace means less total time spent running, so the
                  absolute saving is slightly less than a simple percentage of the original time. For example, a 4%
                  benefit on a 3:00:00 marathon saves approximately 6 minutes 55 seconds — not 7 minutes 12 seconds —
                  because you are also spending less time running at the improved pace.
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  What Affects the Rating
                </h3>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 16 }}>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Carbon plate presence</span>
                    {" — "}the biggest single factor, contributing +2 to 3% on its own.
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Foam technology</span>
                    {" — "}PEBA foam (ZoomX, LightStrike Pro) adds roughly 1.5 to 2%; standard TPU adds 0.5 to 1%;
                    traditional EVA adds negligible benefit.
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Stack height</span>
                    {" — "}more foam means more stored energy. The optimal range for carbon racing shoes is 35 to 40mm.
                    Very high stacks (45mm+) can reduce efficiency due to instability.
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Shoe weight</span>
                    {" — "}every 100g reduction in shoe mass improves running economy by approximately 1%.
                  </div>
                  <div>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Rocker geometry</span>
                    {" — "}the curvature of the sole affects forward propulsion. Benefits vary by individual
                    biomechanics and cadence.
                  </div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Limitations
                </h3>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 16 }}>
                  <div style={{ marginBottom: 4 }}>
                    Individual results vary significantly. Some runners respond much more strongly to super shoes
                    than others, depending on running mechanics, cadence, and foot strike pattern.
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    Published studies measure benefits in controlled lab conditions. Real-world race gains may differ
                    due to terrain, weather, fatigue, and pacing strategy.
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    PEBA foam degrades after roughly 400 to 500 km of use. Traditional EVA foam maintains performance
                    characteristics longer, typically 600 to 800 km.
                  </div>
                  <div>
                    Most research focuses on flat road running at race pace. Trail shoes and ultra-distance running
                    show different benefit patterns due to terrain variability and slower paces.
                  </div>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Sources
                </h3>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
                  <div>Hoogkamer et al. (2017) — Original Vaporfly 4% study, Sports Medicine</div>
                  <div>Kobayashi et al. (2026) — Carbon plate meta-analysis (14 studies, 271 runners), Frontiers in Sports</div>
                  <div>Bolliger et al. (2026) — Speed-independent benefits of carbon-plated shoes, Sports Medicine Open</div>
                  <div>RunRepeat shoe database — 700+ shoes lab-tested for running economy</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
