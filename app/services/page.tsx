"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Link2, Globe, QrCode, CheckCircle2 } from "lucide-react"

export default function ServicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const active = localStorage.getItem("gaur_premium_active") === "true";
      if (!active) {
        router.push("/");
      } else {
        setLoading(false);
      }
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const services = [
    {
      icon: <Link2 className="w-12 h-12 text-accent" />,
      title: "Smart Redirect Links",
      description:
        "Create lightweight, stateless redirection links that forward visitors to any URL securely, using either clean readable paths or base64 obfuscation.",
      features: [
        "Base64 secure obfuscation",
        "Clean URL forwarding",
        "100% serverless redirections",
        "Privacy-respecting hops",
      ],
    },
    {
      icon: <Globe className="w-12 h-12 text-accent" />,
      title: "UTM Campaign Builder",
      description:
        "Standardize and build your marketing campaign URLs with Google Analytics UTM parameters to easily track your traffic sources and mediums.",
      features: [
        "Set source, medium, campaign",
        "Obfuscated target redirection",
        "Pre-validated URL formats",
        "Marketing strategy integration",
      ],
    },
    {
      icon: <QrCode className="w-12 h-12 text-accent" />,
      title: "Instant QR Code Generator",
      description:
        "Get instant, downloadable QR code images for any of your generated links to place on brochures, flyers, slides, and packaging.",
      features: [
        "Dynamic high-resolution images",
        "One-click direct downloads",
        "Universal scanner compatibility",
        "Offline-to-online connection",
      ],
    },
  ]

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative bg-primary pt-32 pb-24 md:pt-40 md:pb-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold font-[family-name:var(--font-poppins)] text-white mb-6 text-balance">
              Our <span className="text-accent">Utilities</span>
            </h1>
            <p className="text-lg md:text-xl text-white/90 leading-relaxed">
              Comprehensive smart linking utilities designed to help your campaigns run efficiently
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {services.map((service, index) => (
              <Card
                key={index}
                className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-2 border-transparent hover:border-accent/20"
              >
                <CardContent className="p-8">
                  <div className="mb-6 transform group-hover:scale-110 transition-transform duration-300">
                    {service.icon}
                  </div>
                  <h3 className="text-2xl font-bold font-[family-name:var(--font-poppins)] text-primary mb-4">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">{service.description}</p>
                  <ul className="space-y-3">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5 mr-2" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold font-[family-name:var(--font-poppins)] mb-6 text-balance">
            Ready to Build a Link?
          </h2>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Start creating tracked redirects and campaign URLs right now.
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white text-lg px-8 py-6">
            <Link href="/">Launch Link Workspace</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
