import React from 'react';

interface PageHeroProps {
    title: string;
    subtitle?: string;
}

export default function PageHero({ title, subtitle }: PageHeroProps) {
    return (
        <div className="relative bg-gray-900 overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,rgba(255,255,255,.05)_25%,transparent_25%,transparent_75%,rgba(255,255,255,.05)_75%)] bg-[length:20px_20px]"></div>
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-in slide-in-from-bottom-4 duration-700">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-xl md:text-2xl text-gold-100 max-w-3xl mx-auto leading-relaxed animate-in slide-in-from-bottom-5 duration-700 delay-100">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}
