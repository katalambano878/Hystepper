'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  verified: boolean;
  title: string;
  content: string;
  helpful: number;
  user_id: string;
}

interface ProductReviewsProps {
  productId: string;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState('all');
  // Honour ?review=write (sent in delivered-order SMS / email links) so the
  // customer lands directly on the form instead of having to scroll past
  // existing reviews to find the "Write a Review" button.
  const autoOpenReview = searchParams?.get('review') === 'write';
  const [showReviewForm, setShowReviewForm] = useState(autoOpenReview);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: '',
    content: ''
  });

  useEffect(() => {
    // Check auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    fetchReviews();
  }, [productId]);

  // Once the form is mounted (either via auto-open or manual click), scroll
  // it into view. Runs after `loading` flips so the form actually exists.
  useEffect(() => {
    if (!showReviewForm || loading) return;
    // Defer to next frame so the DOM has the form node painted.
    const id = requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [showReviewForm, loading]);

  const fetchReviews = async () => {
    try {
      // Fetch approved reviews
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('status', 'approved') // Only show approved
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // We need to fetch user names if possible. Since we don't have public profiles easily accessible 
        // without complicated RLS/joins in client, we might fallback to generic name or metadata if stored.
        // For this demo, we'll try to use a "clean" name or just "Verified Customer"

        const formattedReviews = data.map(r => ({
          id: r.id,
          author: 'Verified Customer', // or fetch from profiles if we had it joined
          rating: r.rating,
          date: r.created_at,
          verified: r.verified_purchase,
          title: r.title,
          content: r.content,
          helpful: r.helpful_votes || 0,
          user_id: r.user_id
        }));
        setReviews(formattedReviews);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => r.rating === star).length;
    return {
      star,
      count,
      percentage: reviews.length > 0 ? (count / reviews.length) * 100 : 0
    };
  });

  const filteredReviews = filter === 'all'
    ? reviews
    : reviews.filter(r => r.rating === parseInt(filter));

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('Please login to submit a review');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user has actually ordered this product
      const { data: purchaseCheck } = await supabase
        .from('order_items')
        .select('id, orders!inner(user_id, status)')
        .eq('product_id', productId)
        .eq('orders.user_id', user.id)
        .eq('orders.status', 'delivered')
        .limit(1);

      const isVerifiedPurchase = (purchaseCheck && purchaseCheck.length > 0);

      const { error } = await supabase.from('reviews').insert([{
        product_id: productId,
        user_id: user.id,
        rating: reviewForm.rating,
        title: reviewForm.title,
        content: reviewForm.content,
        status: 'pending', // Require admin approval
        verified_purchase: isVerifiedPurchase
      }]);

      if (error) throw error;

      alert('Review submitted! It will appear after admin approval.');
      setShowReviewForm(false);
      setReviewForm({ rating: 5, title: '', content: '' });
      fetchReviews(); // Refresh list

    } catch (err: any) {
      console.error('Submit review error:', err);
      alert('Failed to submit review: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="py-8 text-center text-gray-500">Loading reviews...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Reviews</h2>

      {reviews.length === 0 && !showReviewForm ? (
        <div className="text-center py-8 mb-8 border-b border-gray-200">
          <p className="text-gray-500 mb-4">No reviews yet. Be the first to review!</p>
          <button
            onClick={() => setShowReviewForm(true)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            Write a Review
          </button>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-gray-200">
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900 mb-2">{averageRating.toFixed(1)}</div>
              <div className="flex items-center justify-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    key={star}
                    className={`ri-star-${star <= Math.round(averageRating) ? 'fill' : 'line'} text-xl ${star <= Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                  ></i>
                ))}
              </div>
              <p className="text-gray-600">Based on {reviews.length} reviews</p>
            </div>

            <div className="md:col-span-2">
              <div className="space-y-2">
                {ratingDistribution.map((dist) => (
                  <div key={dist.star} className="flex items-center space-x-3">
                    <button
                      onClick={() => setFilter(dist.star.toString())}
                      className="flex items-center space-x-1 hover:text-emerald-700 transition-colors"
                    >
                      <span className="text-sm font-medium w-6">{dist.star}</span>
                      <i className="ri-star-fill text-yellow-400 text-sm"></i>
                    </button>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400 transition-all duration-300"
                        style={{ width: `${dist.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8">{dist.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${filter === 'all'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                All Reviews ({reviews.length})
              </button>
              {/* Simplified filter buttons for brevity */}
            </div>

            {!showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Write a Review
              </button>
            )}
          </div>
        </>
      )}

      {showReviewForm && (
        <form ref={formRef} onSubmit={handleSubmitReview} className="bg-gray-50 rounded-xl p-6 mb-8 scroll-mt-24">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Write Your Review</h3>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Your Rating *</label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                  className="w-10 h-10 flex items-center justify-center"
                >
                  <i
                    className={`ri-star-${star <= reviewForm.rating ? 'fill' : 'line'} text-3xl ${star <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                  ></i>
                </button>
              ))}
            </div>
          </div>

          {!user && (
            <div className="mb-4 p-4 bg-amber-50 text-amber-800 rounded-lg">
              You must be logged in to submit a review.
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Review Title *</label>
            <input
              type="text"
              value={reviewForm.title}
              onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Sum up your experience"
              required
              disabled={!user}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Your Review *</label>
            <textarea
              value={reviewForm.content}
              onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Share your experience with this product"
              required
              disabled={!user}
            ></textarea>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={isSubmitting || !user}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
            <button
              type="button"
              onClick={() => setShowReviewForm(false)}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {filteredReviews.map((review) => (
          <div key={review.id} className="pb-6 border-b border-gray-200 last:border-0">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-100 rounded-full text-emerald-700 font-bold text-lg">
                  {review.author.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{review.author}</span>
                    {review.verified && (
                      <span className="flex items-center text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                        <i className="ri-checkbox-circle-fill mr-1"></i>
                        Verified Must Have
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{new Date(review.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i
                    key={star}
                    className={`ri-star-${star <= review.rating ? 'fill' : 'line'} text-lg ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                  ></i>
                ))}
              </div>
            </div>

            <h4 className="font-semibold text-gray-900 mb-2">{review.title}</h4>
            <p className="text-gray-700 mb-4">{review.content}</p>

            <div className="flex items-center space-x-4 text-sm">
              <button className="flex items-center space-x-1 text-gray-600 hover:text-emerald-700 transition-colors">
                <i className="ri-thumb-up-line"></i>
                <span>Helpful ({review.helpful})</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
