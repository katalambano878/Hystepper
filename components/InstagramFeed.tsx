'use client';

import { useState } from 'react';
import Link from 'next/link';

interface InstagramPost {
  id: string;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  link: string;
}

const mockPosts: InstagramPost[] = [
  {
    id: '1',
    image: 'https://readdy.ai/api/search-image?query=modern%20fashion%20store%20interior%20with%20elegant%20clothing%20displays%20natural%20lighting%20minimalist%20design%20high%20end%20boutique%20atmosphere%20professional%20retail%20photography&width=400&height=400&seq=ig1&orientation=squarish',
    caption: 'New summer collection arriving soon! 🌞',
    likes: 1247,
    comments: 89,
    link: 'https://www.instagram.com/hy_stepper'
  },
  {
    id: '2',
    image: 'https://readdy.ai/api/search-image?query=stylish%20product%20flat%20lay%20photography%20with%20fashion%20accessories%20and%20lifestyle%20items%20on%20white%20background%20aesthetic%20composition%20instagram%20worthy%20shot&width=400&height=400&seq=ig2&orientation=squarish',
    caption: 'Behind the scenes of our latest photoshoot 📸',
    likes: 2103,
    comments: 156,
    link: 'https://instagram.com'
  },
  {
    id: '3',
    image: 'https://readdy.ai/api/search-image?query=happy%20customers%20shopping%20in%20modern%20retail%20store%20diverse%20people%20enjoying%20shopping%20experience%20bright%20welcoming%20atmosphere%20candid%20photography&width=400&height=400&seq=ig3&orientation=squarish',
    caption: 'Customer love ❤️ Thank you for your support!',
    likes: 3421,
    comments: 234,
    link: 'https://instagram.com'
  },
  {
    id: '4',
    image: 'https://readdy.ai/api/search-image?query=trending%20fashion%20products%20beautifully%20arranged%20on%20display%20colorful%20items%20creative%20merchandising%20eye%20catching%20retail%20presentation&width=400&height=400&seq=ig4&orientation=squarish',
    caption: 'Just restocked! Shop these bestsellers now 🛍️',
    likes: 1876,
    comments: 142,
    link: 'https://instagram.com'
  },
  {
    id: '5',
    image: 'https://readdy.ai/api/search-image?query=eco%20friendly%20sustainable%20shopping%20concept%20with%20reusable%20bags%20and%20natural%20products%20green%20living%20aesthetic%20earth%20tones&width=400&height=400&seq=ig5&orientation=squarish',
    caption: 'Sustainability is our priority 🌱',
    likes: 2654,
    comments: 198,
    link: 'https://instagram.com'
  },
  {
    id: '6',
    image: 'https://readdy.ai/api/search-image?query=exclusive%20limited%20edition%20product%20showcase%20luxury%20packaging%20premium%20quality%20items%20elegant%20presentation%20special%20collection&width=400&height=400&seq=ig6&orientation=squarish',
    caption: 'Limited edition drop! Only 50 pieces available',
    likes: 4231,
    comments: 567,
    link: 'https://instagram.com'
  }
];

export default function InstagramFeed() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <i className="ri-instagram-line text-4xl text-pink-600"></i>
            <h2 className="text-3xl font-bold text-gray-900">Follow Us on Instagram</h2>
          </div>
          <p className="text-gray-600 text-lg mb-6">
            Join our community and get inspired by our latest posts
          </p>
          <a
            href="https://www.instagram.com/hy_stepper"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:shadow-lg transition-all hover:scale-105"
          >
            <i className="ri-instagram-fill text-xl"></i>
            Follow @hy_stepper
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {mockPosts.map((post) => (
            <a
              key={post.id}
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
              onMouseEnter={() => setHoveredId(post.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <img
                src={post.image}
                alt={post.caption}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />

              <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${hoveredId === post.id ? 'opacity-100' : 'opacity-0'
                }`}>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-1">
                      <i className="ri-heart-fill text-xl"></i>
                      <span className="font-semibold">{post.likes.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <i className="ri-chat-3-fill text-xl"></i>
                      <span className="font-semibold">{post.comments}</span>
                    </div>
                  </div>
                  <p className="text-sm text-center line-clamp-2">{post.caption}</p>
                </div>
              </div>

              <div className="absolute top-2 right-2">
                <div className="w-8 h-8 flex items-center justify-center bg-white/90 rounded-full">
                  <i className="ri-instagram-line text-pink-600"></i>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="text-center mt-8">
          <p className="text-gray-600">
            Tag us <span className="font-semibold text-gold-600">#Hy_stepper</span> to be featured!
          </p>
        </div>
      </div>
    </div>
  );
}