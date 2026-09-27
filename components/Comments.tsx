"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface Comment {
  id: string;
  name: string;
  text: string;
  createdAt: any;
}

const colors = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500",
  "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"
];

function getAvatarColor(name: string) {
  const charCode = name.charCodeAt(0) || 0;
  return colors[charCode % colors.length];
}

function timeAgo(date: Date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return "Just now";
}

export default function Comments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  
  // Emoji Picker State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const generateCaptcha = () => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
    setCaptchaAnswer("");
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (parseInt(captchaAnswer) !== num1 + num2) {
      setError("Incorrect math answer. Please try again.");
      generateCaptcha();
      return;
    }

    if (!name.trim() || !email.trim() || !text.trim()) {
      setError("All fields are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "comments"), {
        name,
        email, // Email is saved to DB but never rendered in the UI below
        text,
        createdAt: serverTimestamp(),
      });
      setName("");
      setEmail("");
      setText("");
      generateCaptcha(); // Regenerate CAPTCHA after successful submit
      setIsFormExpanded(false); // Auto-collapse the form
      setShowEmojiPicker(false);
    } catch (err) {
      console.error("Error adding comment: ", err);
      setError("Failed to post comment. Try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      {/* 1. Comments Feed (Displayed FIRST) */}
      <div className="space-y-4">
        <h3 className="text-gray-700 font-medium px-1">
          {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
        </h3>
        
        {comments.map((comment) => (
          <div key={comment.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-3">
              <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-lg ${getAvatarColor(comment.name)}`}>
                {comment.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-gray-100 rounded-2xl px-4 py-3 inline-block">
                  <span className="block font-semibold text-gray-900 text-[15px]">
                    {comment.name}
                  </span>
                  <p className="text-gray-800 mt-1 whitespace-pre-wrap text-[15px]">
                    {comment.text}
                  </p>
                </div>
                <div className="flex items-center space-x-4 mt-1 px-4 text-xs text-gray-500">
                  <span>
                    {comment.createdAt?.toDate ? timeAgo(comment.createdAt.toDate()) : "Just now"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </div>

      {/* 2 & 3. Progressive Disclosure Form */}
      <div className="border-t border-gray-200 pt-6">
        {!isFormExpanded ? (
          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={() => setIsFormExpanded(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2.5 transition-colors shadow-sm flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
              </svg>
              Write a comment
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <svg className="h-3.5 w-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              (your email address will remain private)
            </span>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Leave a Comment</h2>
              <button 
                onClick={() => setIsFormExpanded(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Cancel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Your Email (Private)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    required
                  />
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-blue-50/70 border border-blue-200/70 px-3 py-2 text-xs text-slate-600">
                    <svg
                      className="h-4 w-4 shrink-0 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span>
                      <strong className="font-semibold text-slate-800">🔒 Your email address will remain private:</strong> It will never be displayed publicly or shared.
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="relative border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all bg-white">
                <textarea
                  placeholder="Write your comment..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full px-4 py-3 outline-none resize-none bg-transparent"
                  required
                ></textarea>
                
                <div className="absolute bottom-2 right-2 flex items-center" ref={emojiPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
                    title="Insert an emoji"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-2 z-50">
                      <EmojiPicker onEmojiClick={onEmojiClick} />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center space-x-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200 w-full sm:w-auto">
                  <span className="text-gray-700 font-medium whitespace-nowrap text-sm">What is {num1} + {num2}?</span>
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-center"
                    required
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto justify-end">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <svg
                      className="h-3.5 w-3.5 text-blue-600 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span>🔒 Your email address will remain private</span>
                  </span>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsFormExpanded(false)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-medium rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-6 py-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isSubmitting ? "Posting..." : "Post Comment"}
                    </button>
                  </div>
                </div>
              </div>
              
              {error && <p className="text-red-500 text-sm font-medium pt-2">{error}</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
