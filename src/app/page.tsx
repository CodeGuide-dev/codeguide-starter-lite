"use client";

import { Button } from "@/components/ui/button";
import {
  Terminal,
  Code,
  Zap,
  ArrowRight,
  Github,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      {/* Header */}
      <header className="absolute top-0 right-0 p-6">
        <ThemeToggle />
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo/Icon */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-black dark:border-white mb-6">
              <Terminal className="w-10 h-10" />
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-6xl md:text-8xl font-light mb-6 tracking-tight">
            Codespace
          </h1>
          
          {/* Subtitle */}
          <p className="text-xl md:text-2xl font-light mb-12 max-w-2xl mx-auto leading-relaxed">
            Your intelligent AI CLI companion for seamless development workflows
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Button 
              size="lg" 
              className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 font-light text-lg px-8 py-4"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-black text-black hover:bg-black hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black font-light text-lg px-8 py-4"
            >
              <Github className="mr-2 w-5 h-5" />
              View on GitHub
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-black dark:border-white mb-6">
                <Code className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-light mb-4">Intelligent Code Generation</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                Generate, refactor, and optimize code with AI-powered suggestions directly from your terminal
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-black dark:border-white mb-6">
                <Terminal className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-light mb-4">Native CLI Experience</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                Seamlessly integrated into your existing workflow with intuitive command-line interfaces
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-black dark:border-white mb-6">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-light mb-4">Lightning Fast</h3>
              <p className="text-gray-600 dark:text-gray-400 font-light leading-relaxed">
                Optimized for speed and efficiency, delivering instant responses to your development needs
              </p>
            </div>
          </div>

          {/* Command Preview */}
          <div className="mt-20">
            <div className="bg-black dark:bg-white text-white dark:text-black rounded-lg p-6 max-w-2xl mx-auto text-left" style={{fontFamily: 'var(--font-jetbrains-mono)'}}>
              <div className="flex items-center mb-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="text-gray-400 dark:text-gray-600">$</span>
                  <span className="ml-2">codespace generate --component LoginForm</span>
                </div>
                <div className="text-gray-400 dark:text-gray-600">
                  ✨ Generating React component...
                </div>
                <div className="text-gray-400 dark:text-gray-600">
                  📝 Created LoginForm.tsx with TypeScript support
                </div>
                <div className="text-gray-400 dark:text-gray-600">
                  🎨 Added Tailwind CSS styling
                </div>
                <div className="text-gray-400 dark:text-gray-600">
                  ✅ Component ready!
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
