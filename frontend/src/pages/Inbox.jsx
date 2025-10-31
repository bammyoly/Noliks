import React, { useState } from 'react';
import { useAccount } from 'wagmi';

const dummyEmails = [
  {
    id: 1,
    sender: 'Zamail Team',
    subject: 'Welcome to Zamail!',
    snippet: 'We are thrilled to have you join the first brokerage network for DeFi...',
    date: 'Oct 30',
    read: false,
  },
];

const Inbox = () => {
  const { address } = useAccount();
  const [selectedMail, setSelectedMail] = useState(dummyEmails[0] || null);
  // controls mobile: show list vs show detail
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleSelectMail = (mail) => {
    setSelectedMail(mail);
    // on mobile, switch to detail view
    setIsDetailOpen(true);
  };

  const handleBackToList = () => {
    setIsDetailOpen(false);
  };

  const unreadCount = dummyEmails.filter((e) => !e.read).length;

  const MessageList = () => (
    <div
      className={`
        w-full md:w-80 border-r border-gray-200 h-full overflow-y-auto bg-white shadow-lg
        ${isDetailOpen ? 'hidden md:block' : 'block'}
      `}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg md:text-xl font-bold text-gray-800">
          Inbox ({unreadCount} unread)
        </h2>
      </div>

      {dummyEmails.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No messages.</div>
      ) : (
        dummyEmails.map((mail) => (
          <div
            key={mail.id}
            onClick={() => handleSelectMail(mail)}
            className={`
              p-4 border-b border-gray-100 cursor-pointer transition-colors
              ${selectedMail?.id === mail.id
                ? 'bg-red-50 md:border-l-4 md:border-red-600'
                : 'hover:bg-gray-50'}
            `}
          >
            <div className={`font-semibold ${mail.read ? 'text-gray-600' : 'text-gray-900'}`}>
              {mail.sender}
            </div>
            <div className={`text-sm ${mail.read ? 'text-gray-500' : 'text-gray-700'}`}>
              {mail.subject}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs text-gray-400 truncate pr-2">{mail.snippet}</div>
              <span className="text-xs text-gray-400">{mail.date}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const MessageDetail = () => {
    if (!selectedMail) {
      return (
        <div
          className={`
            flex-1 h-full overflow-y-auto bg-gray-50
            ${isDetailOpen ? 'block' : 'hidden'} md:block
          `}
        >
          <div className="p-6 text-center text-gray-500">Select a message to read.</div>
        </div>
      );
    }

    return (
      <div
        className={`
          flex-1 h-full overflow-y-auto bg-gray-50
          ${isDetailOpen ? 'block' : 'hidden'} md:block
        `}
      >
        <div className="p-4 md:p-8">
          {/* mobile header with back button */}
          <div className="flex items-center gap-3 mb-4 md:hidden">
            <button
              onClick={handleBackToList}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-100"
            >
              ← Back
            </button>
            <p className="text-xs text-gray-400">Viewing message</p>
          </div>

          <div className="border-b border-gray-200 pb-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">
              {selectedMail.subject}
            </h2>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center text-sm text-gray-500 gap-2">
              <p>
                From:{' '}
                <span className="font-medium text-gray-700">{selectedMail.sender}</span>
              </p>
              <p>{selectedMail.date}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button className="px-4 py-2 text-sm bg-yellow-600 hover:bg-red-700 text-white rounded-lg">
              Reply
            </button>
            <button className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg">
              Delete
            </button>
          </div>

          <div className="text-gray-700 leading-relaxed bg-white md:bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-100 md:border-gray-200 shadow-sm">
            <p>
              Dear{' '}
              {address
                ? address.substring(0, 6) + '...' + address.substring(address.length - 4)
                : '[User]'}
              ,
            </p>
            <p className="mt-4">
              Thank you for being an early user of the zamail. The full message body for "
              {selectedMail.subject}" would appear here. Since this is a blockchain application,
              the message content may be loaded from a decentralized storage solution (like IPFS)
              based on a transaction ID, or fetched from a secure off-chain relay.
            </p>
            <p className="mt-4 text-xs italic text-gray-500">
              Snippet: {selectedMail.snippet}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen md:h-[calc(100vh-0px)] bg-gray-50">
      <MessageList />
      <MessageDetail />
    </div>
  );
};

export default Inbox;
