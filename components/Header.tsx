"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLanguage, t } from "@/lib/language";
import { Search, Menu, WhatsApp, Heart, Globe, X, ShoppingBag } from "lucide-react";

const CATEGORIES_NAV = [
  { slug: "mens-fashion", name_en: "Men's Fashion", name_gu: "પુરુષોનો ફેશન" },
  { slug: "womens-fashion", name_en: "Women's Fashion", name_gu: "મહિલાઓનો ફેશન" },
  { slug: "kids-fashion", name_en: "Kids Fashion", name_gu: "બાળકોનું ફેશન" },
  { slug: "traditional-wear", name_en: "Traditional Wear", name_gu: "પરંપરાગત પોશાક" },
];

export default function Header() {
  const { lang, setLang, isGujarati, ready } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const wl = JSON.parse(localStorage.getItem("ranj_wishlist") || "[]");
        setWishlistCount(Array.isArray(wl) ? wl.length : 0);
      } catch {
        setWishlistCount(0);
      }
    };
    updateCount();
    window.addEventListener("storage", updateCount);
    return () => window.removeEventListener("storage", updateCount);
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setSearchOpen(false);
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    },
    [searchQuery]
  );

  if (!ready) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex flex-col lg:flex-row gap-2">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-pink-600 flex items-center justify-center text-white font-bold">
              RF
            </div>
            <span className="font-serif text-xl font-bold tracking-tight">
              RANJ FASHION
            </span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-4">
          <div className="relative w-full max-w-md">
            <form onSubmit={handleSearch} className="flex w-full">
              <input
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-600 focus:border-transparent outline-none text-sm"
                placeholder={t({ name_en: "Search products", name_gu: "ઉત્પાદન શોધો" }, lang)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
            </form>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 px-4 py-3 lg:px-6">
          <button
            onClick={() => setLang(isGujarati ? "en" : "gu")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
            aria-label={isGujarati ? "Switch to English" : "Switch to Gujarati"}
          >
            <Globe className="h-4 w-4" />
            <span>{isGujarati ? "EN" : "ગુજરાતી"}</span>
          </button>

          <button
            onClick={() => {
              window.location.href = `https://wa.me/919999999999`;
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
            aria-label="WhatsApp"
          >
            <WhatsApp className="h-4 w-4 text-green-600" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          <button
            onClick={() => {
              window.location.href = "/wishlist";
            }}
            className="relative p-2 rounded-md hover:bg-gray-50 text-gray-600"
            aria-label={`Wishlist (${wishlistCount})`}
          >
            <Heart className="h-5 w-5" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
                {wishlistCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-50 text-gray-600"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="hidden lg:flex bg-white border-t border-gray-100 px-6 py-2">
        <div className="flex items-center gap-8 text-sm font-medium">
          <Link
            href="/category?category=mens-fashion"
            className="hover:text-pink-600 transition"
          >
            {t(CATEGORIES_NAV[0], lang)}
          </Link>
          <Link
            href="/category?category=womens-fashion"
            className="hover:text-pink-600 transition"
          >
            {t(CATEGORIES_NAV[1], lang)}
          </Link>
          <Link
            href="/category?category=kids-fashion"
            className="hover:text-pink-600 transition"
          >
            {t(CATEGORIES_NAV[2], lang)}
          </Link>
          <Link
            href="/collection"
            className="hover:text-pink-600 transition"
          >
            Collections
          </Link>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-2">
          {CATEGORIES_NAV.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category?category=${cat.slug}`}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-pink-600"
            >
              {t(cat, lang)}
            </Link>
          ))}
          <Link
            href="/collection"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg hover:bg-gray-50 hover:text-pink-600"
          >
            Collections
          </Link>
          <button
            onClick={() => setLang(isGujarati ? "en" : "gu")}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            {isGujarati ? "English" : "ગુજરાતી"}
          </button>
          <button
            onClick={() => (window.location.href = `https://wa.me/919999999999`)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            WhatsApp
          </button>
        </div>
      )}
    </header>
  );
}
