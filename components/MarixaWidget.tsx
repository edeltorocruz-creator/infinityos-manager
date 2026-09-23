'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Mic, Volume2, VolumeX } from 'lucide-react'

export function MarixaWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>(() => {
    try { return JSON.parse(sessionStorage.getItem('marixa-chat') || '[]') } catch { return [] }
  })

  // Keep the conversation across widget close/reopen and page navigation
  useEffect(() => {
    try { sessionStorage.setItem('marixa-chat', JSON.stringify(messages.slice(-30))) } catch {}
  }, [messages])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const voiceEnabledRef = useRef(voiceEnabled)
  voiceEnabledRef.current = voiceEnabled

  // Speak Marixa's replies out loud (Spanish)
  const speak = (text: string) => {
    if (!voiceEnabledRef.current || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    const esVoice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('es'))
    if (esVoice) utterance.voice = esVoice
    window.speechSynthesis.speak(utterance)
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.lang = 'es-ES' // Spanish
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('')
        setInput(transcript)
        setIsListening(false)
      }

      recognitionRef.current.onerror = () => {
        setIsListening(false)
      }
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/marixa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: userMessage, history: messages.slice(-10) }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessages((prev) => [...prev, { role: 'error', content: data.error || 'Error desconocido' }])
      } else {
        const botMessage = data.message || 'Sin respuesta'
        setMessages((prev) => [...prev, { role: 'marixa', content: botMessage }])
        speak(botMessage)
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'error', content: 'Error al conectar con Marixa' }])
    } finally {
      setLoading(false)
    }
  }

  const toggleListening = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop()
        setIsListening(false)
      } else {
        recognitionRef.current.start()
        setIsListening(true)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg z-40 transition-all duration-200"
          title="Open Marixa Assistant"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">Marixa</h3>
              <p className="text-xs opacity-90">Tu asistente inteligente</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (voiceEnabled) window.speechSynthesis?.cancel()
                  setVoiceEnabled(!voiceEnabled)
                }}
                className="hover:bg-blue-800 p-1 rounded transition-colors"
                title={voiceEnabled ? 'Silenciar voz' : 'Activar voz'}
              >
                {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-blue-800 p-1 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <p className="font-semibold">¿Hola! Soy Marixa 🤖</p>
                <p className="text-sm mt-2">Puedo ayudarte con:</p>
                <ul className="text-xs mt-3 space-y-1">
                  <li>📅 Crear citas</li>
                  <li>💰 Ver clientes sin pagar</li>
                  <li>📊 Consultar cotizaciones</li>
                  <li>👥 Gestionar clientes</li>
                </ul>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : msg.role === 'error'
                        ? 'bg-red-100 text-red-800 rounded-bl-none'
                        : 'bg-gray-200 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4 bg-white rounded-b-lg space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Di algo a Marixa..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleListening}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isListening
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                <Mic size={18} />
                {isListening ? 'Escuchando...' : 'Micrófono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
