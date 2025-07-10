"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pill, MessageCircle, Clock, Star, Calendar, Heart, CheckCircle, ChevronRight } from "lucide-react"
import { motion } from "framer-motion"

export default function HomePage() {
  const blueButton =
    "h-10 px-6 bg-[#1a103d] text-white border border-[#a970ff] rounded-full text-base font-medium shadow-none hover:bg-[#1a103d] hover:border-[#a970ff] hover:text-white"

  const primaryButton =
    "h-10 px-6 bg-[#1a103d] text-white border border-[#a970ff] rounded-full text-base font-medium shadow-none hover:bg-[#1a103d] hover:border-[#a970ff] hover:text-white"

  const headerButton =
    "h-10 px-6 bg-[#1a103d] text-white border border-[#a970ff] rounded-full text-base font-medium shadow-none hover:bg-[#1a103d] hover:border-[#a970ff] hover:text-white"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-900 text-white flex flex-col items-center justify-start overflow-x-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header Section */}
      <header className="fixed top-0 left-0 w-full bg-slate-950/80 backdrop-blur-md z-50 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 relative">
              <Image src="/logo.png" alt="MediBot Logo" width={40} height={40} className="rounded-full object-cover" />
            </div>
            <h1 className="text-xl font-bold text-white">MediBot</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth/signin">
              <Button className={headerButton}>
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className={headerButton}>
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section (from shape-hero.json) */}
      <section className="relative py-12 md:pt-36 lg:pb-24 overflow-hidden">
        <div className="absolute inset-0">
          <svg className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 800">
            <path d="M0,0 C300,100 600,50 900,150 C1200,250 1440,200 1440,400 V800 H0 Z" fill="url(#gradient)" />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#6b21a8', stopOpacity: 0.1 }} />
                <stop offset="100%" style={{ stopColor: '#3b0764', stopOpacity: 0.1 }} />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="relative max-w-7xl mt-20 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center ">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl"
            >
              Transform Your Health with MediBot
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-6 max-w-2xl mx-auto text-xl text-gray-300"
            >
              Your AI-powered health companion that simplifies medication management, provides personalized insights, and ensures you never miss a dose.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-10 flex justify-center gap-4"
            >
              <Button
                asChild
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-[#1a103d] border-[#a970ff] hover:bg-[#1a103d] hover:border-[#a970ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#a970ff]"
              >
                <Link href="/auth/signup">Get Started</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="inline-flex items-center px-6 py-3 border border-[#a970ff] text-base font-medium rounded-full text-white bg-transparent hover:bg-[#1a103d] hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#a970ff]"
              >
                <Link href="/demo">Learn More</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-7xl mx-auto px-6 py-20 relative"
      >
        <div className="absolute -top-20 left-0 w-full h-20 pointer-events-none" id="features" />
        
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-purple-500/10 text-purple-400 rounded-full text-sm font-medium mb-4">
            Powerful Features
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Take Control of Your Health
          </h2>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
            MediBot combines cutting-edge technology with intuitive design to revolutionize your health management.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: <Pill className="h-6 w-6 text-purple-400" />,
              title: "Smart Medication Tracking",
              description: "Easily log and track your medications with our intuitive interface. Set up schedules, view history, and get insights into your adherence."
            },
            {
              icon: <MessageCircle className="h-6 w-6 text-purple-400" />,
              title: "AI-Powered Health Chat",
              description: "Ask MediBot anything about your health or prescriptions. Our AI provides accurate, personalized advice to support your wellness journey."
            },
            {
              icon: <Clock className="h-6 w-6 text-purple-400" />,
              title: "Timely Reminders",
              description: "Receive customized reminders via email, WhatsApp, or push notifications to stay on top of your medication schedule."
            },
            {
              icon: <Calendar className="h-6 w-6 text-purple-400" />,
              title: "Health Calendar",
              description: "Visualize your medication and appointment schedules in a sleek, interactive calendar to plan your health routine effectively."
            },
            {
              icon: <Heart className="h-6 w-6 text-purple-400" />,
              title: "Personalized Insights",
              description: "Get tailored health tips and analytics based on your medication adherence and health data to optimize your well-being."
            },
            {
              icon: <CheckCircle className="h-6 w-6 text-purple-400" />,
              title: "Secure & Private",
              description: "Your data is protected with state-of-the-art encryption, ensuring your health information remains private and secure."
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="bg-slate-800/50 rounded-xl backdrop-blur-sm border border-white/10 shadow-lg shadow-purple-500/5 hover:shadow-purple-500/10 transition-all h-full">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3 text-white text-xl font-semibold">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      {feature.icon}
                    </div>
                    <span>{feature.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 text-base">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* How It Works Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="w-full py-20 bg-gradient-to-br from-slate-900/50 via-purple-950/20 to-slate-950/50"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium mb-4">
              Simple Steps
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              How MediBot Works
            </h2>
            <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
              Get started in minutes and experience the future of health management.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Sign Up",
                description: "Create your account in minutes and set up your health profile."
              },
              {
                step: "2",
                title: "Add Medications",
                description: "Input your prescriptions and schedules with our easy-to-use tools."
              },
              {
                step: "3",
                title: "Stay On Track",
                description: "Receive reminders, insights, and support to manage your health effortlessly."
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-white/10">
                  <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{item.step}</span>
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-slate-300">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Testimonials Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-7xl mx-auto px-6 py-20"
      >
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-yellow-500/10 text-yellow-400 rounded-full text-sm font-medium mb-4">
            User Stories
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Loved by Our Community
          </h2>
          <p className="mt-4 text-lg text-slate-300 max-w-2xl mx-auto">
            Join thousands of users who transformed their health with MediBot.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              name: "Emily R.",
              role: "Diabetes Patient",
              quote: "MediBot has made managing my medications so simple. The AI chat is like having a doctor on call!",
              stars: 5
            },
            {
              name: "Michael T.",
              role: "Senior User",
              quote: "The reminders are a game-changer. I've never felt more in control of my health.",
              stars: 5
            },
            {
              name: "Priya S.",
              role: "Busy Professional",
              quote: "The health insights are spot-on, and the app is so easy to use. Highly recommend!",
              stars: 5
            }
          ].map((testimonial, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="bg-slate-800/50 rounded-xl backdrop-blur-sm border border-white/10 shadow-lg hover:shadow-purple-500/10 transition-all h-full">
                <CardContent className="p-8">
                  <div className="flex items-center space-x-1 mb-6">
                    {[...Array(testimonial.stars)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400/20" />
                    ))}
                  </div>
                  <p className="text-slate-200 text-lg italic mb-6">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold mr-3">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-white font-medium">{testimonial.name}</h4>
                      <p className="text-slate-400 text-sm">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="w-full py-20 bg-gradient-to-br from-slate-950 via-purple-950/30 to-blue-950/30"
      >
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Health?
          </h2>
          <p className="text-slate-300 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Join thousands of users who trust MediBot to simplify their health management.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/auth/signup">
              <Button className={`${primaryButton} w-60 h-14 text-lg`}>
                Get Started Free
              </Button>
            </Link>
            <Link href="/demo">
              <Button className={`${blueButton} w-60 h-14 text-lg gap-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Watch Demo
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="w-full bg-slate-900/80 py-12 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div className="flex items-center space-x-3 mb-6 md:mb-0">
              <div className="w-12 h-12 relative">
                <Image src="/logo.png" alt="MediBot Logo" width={48} height={48} className="rounded-full object-cover" />
              </div>
              <h1 className="text-2xl font-bold text-white">MediBot</h1>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-white font-semibold mb-4">Product</h3>
                <ul className="space-y-3">
                  <li><Link href="/features" className="text-slate-400 hover:text-purple-300 transition-colors">Features</Link></li>
                  <li><Link href="/pricing" className="text-slate-400 hover:text-purple-300 transition-colors">Pricing</Link></li>
                  <li><Link href="/demo" className="text-slate-400 hover:text-purple-300 transition-colors">Demo</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Company</h3>
                <ul className="space-y-3">
                  <li><Link href="/about" className="text-slate-400 hover:text-purple-300 transition-colors">About</Link></li>
                  <li><Link href="/blog" className="text-slate-400 hover:text-purple-300 transition-colors">Blog</Link></li>
                  <li><Link href="/careers" className="text-slate-400 hover:text-purple-300 transition-colors">Careers</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Legal</h3>
                <ul className="space-y-3">
                  <li><Link href="/privacy" className="text-slate-400 hover:text-purple-300 transition-colors">Privacy</Link></li>
                  <li><Link href="/terms" className="text-slate-400 hover:text-purple-300 transition-colors">Terms</Link></li>
                  <li><Link href="/contact" className="text-slate-400 hover:text-purple-300 transition-colors">Contact</Link></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-400 mb-4 md:mb-0">
              © {new Date().getFullYear()} MediBot. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </Link>
              <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}