import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";

const PACKAGE_ID = "0xc47d95f290e52a1a68e85b0f0e3c2d0d694e22b7d3a6beb9a208cb4ba471cfbe"; 

function App() {
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [feed, setFeed] = useState<any[]>([]);
  const [likedNfts, setLikedNfts] = useState<string[]>([]);
  const [selectedNft, setSelectedNft] = useState<any>(null);
  const [modalComment, setModalComment] = useState("");

  const fetchFeed = async () => {
    const { data, error } = await supabase.from('nfts').select('*, nft_comments(*)').order('likes', { ascending: false });
    if (!error && data) setFeed(data);
  };

  useEffect(() => { 
    fetchFeed();
    const savedLikes = JSON.parse(localStorage.getItem('user_likes') || '[]');
    setLikedNfts(savedLikes);
  }, []);

  const topLiked = useMemo(() => feed[0] || null, [feed]);

  const { data: objects, refetch: refetchInventory } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address as string,
      filter: { StructType: `${PACKAGE_ID}::workshop_nft::NFT` },
      options: { showContent: true, showDisplay: true },
      limit: 50,
    },
    { enabled: !!account }
  );

  // Handle Upload File ke Supabase Storage
  const handleFileUpload = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('nft-images')
      .upload(filePath, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      return;
    }

    const { data } = supabase.storage.from('nft-images').getPublicUrl(filePath);
    setImageUrl(data.publicUrl);
    alert("Image uploaded!");
  };

  const handleMint = async () => {
    if (!account || !name || !imageUrl) return;
    setIsMinting(true);
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::workshop_nft::mint_nft`, 
      arguments: [
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(name))),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(description))),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(imageUrl))),
      ],
    });
    signAndExecuteTransaction({ transaction: tx }, { onSuccess: () => { 
      setIsMinting(false);
      alert("NFT Created");
      setName(""); setDescription(""); setImageUrl("");
      setTimeout(() => refetchInventory(), 3000); 
    }});
  };

  const postToFeed = async (nft: any) => {
    const nft_id = nft.data.objectId;
    const nft_name = nft.data.display?.data?.name || "Unnamed NFT";
    const nft_img = nft.data.display?.data?.image_url || nft.data.content?.fields?.url;
    const { error } = await supabase.from('nfts').upsert({ nft_id, name: nft_name, image_url: nft_img }, { onConflict: 'nft_id' });
    if (!error) { alert("Posted!"); fetchFeed(); }
  };

  const handleLike = async (nft_id: string) => {
    if (likedNfts.includes(nft_id)) return;
    const { error } = await supabase.rpc('increment_likes', { row_id: nft_id });
    if (!error) {
      const newLikes = [...likedNfts, nft_id];
      setLikedNfts(newLikes);
      localStorage.setItem('user_likes', JSON.stringify(newLikes));
      fetchFeed();
    }
  };

  const handleAddComment = async () => {
    if (!modalComment || !selectedNft) return;
    const { error } = await supabase.from('nft_comments').insert({ nft_id: selectedNft.nft_id, comment_text: modalComment });
    if (!error) { setModalComment(""); fetchFeed(); }
  };

  return (
    <div className="min-h-screen bg-[#050810] text-white p-4 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      {/* HEADER */}
      <nav className="max-w-6xl mx-auto flex justify-between items-center py-4 md:py-6 border-b border-cyan-500/10 mb-6 md:mb-10 px-2">
        <h1 className="text-2xl md:text-4xl font-black text-glow text-cyan-400 italic tracking-tighter uppercase">SUI NFT Battle</h1>
        <ConnectButton />
      </nav>

      {/* MINTER GRID */}
      <section className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-16 px-2">
        <div className="card-glow bg-gray-900/40 p-4 md:p-8 rounded-2xl md:rounded-3xl border border-white/5">
          <h2 className="text-xs font-bold mb-4 md:mb-6 text-cyan-300 uppercase tracking-widest">Create Your NFT</h2>
          <div className="space-y-3 md:space-y-4">
            <input className="w-full bg-gray-800/50 border border-gray-700 p-2.5 md:p-3 rounded-xl outline-none text-sm focus:border-cyan-500" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Asset Name" />
            <input className="w-full bg-gray-800/50 border border-gray-700 p-2.5 md:p-3 rounded-xl outline-none text-sm focus:border-cyan-500" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Description" />
            
            {/* IMAGE INPUT + UPLOAD BUTTON */}
            <div className="flex gap-2">
              <input className="flex-1 bg-gray-800/50 border border-gray-700 p-2.5 md:p-3 rounded-xl outline-none text-[10px] focus:border-cyan-500" value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} placeholder="Image Link or Upload" />
              <label className="bg-gray-700 hover:bg-cyan-600 hover:text-black px-4 rounded-xl cursor-pointer text-[10px] font-bold flex items-center transition-all whitespace-nowrap">
                UPLOAD
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>

            <button onClick={handleMint} disabled={isMinting || !account} className="w-full py-3 md:py-4 rounded-xl font-black bg-cyan-600 text-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/20 active:scale-95 transition-all">
              {isMinting ? "MINTING..." : !account ? "CONNECT WALLET" : "MINT NFT"}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center p-4 md:p-6 border-2 border-dashed border-cyan-500/20 rounded-2xl md:rounded-3xl bg-cyan-500/5">
          {imageUrl ? <img src={imageUrl} className="w-28 md:w-48 aspect-square object-cover rounded-2xl mb-3 md:mb-4 shadow-2xl animate-pulse" /> : <div className="w-28 md:w-48 aspect-square bg-gray-800 rounded-2xl mb-3 md:mb-4 flex items-center justify-center text-[10px] text-gray-500 italic">No Preview</div>}
          <h3 className="text-sm font-black text-cyan-400 uppercase">{name || "PREVIEW"}</h3>
        </div>
      </section>

      {/* MY NFT: FIXED MOBILE SIZE */}
      <section className="max-w-6xl mx-auto mb-8 md:mb-16 px-2">
        <h2 className="text-lg md:text-xl font-black mb-4 md:mb-6 italic flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-sm shadow-[0_0_10px_#3b82f6]"></span> MY NFT
        </h2>
        <div className="flex md:grid md:grid-cols-8 gap-3 overflow-x-auto pb-4 snap-x snap-mandatory no-scrollbar">
          {objects?.data?.map((obj: any) => (
            <div key={obj.data.objectId} className="max-w-[80px] min-w-[80px] md:max-w-none md:min-w-0 bg-gray-900/80 border border-white/5 p-2 rounded-xl flex-shrink-0 card-glow snap-center">
              <img src={obj.data.display?.data?.image_url || obj.data.content?.fields?.url} className="aspect-square object-cover rounded-lg mb-2" />
              <button onClick={() => postToFeed(obj)} className="w-full py-1 bg-white text-black text-[8px] font-black rounded uppercase hover:bg-cyan-400 transition-colors">Post</button>
            </div>
          ))}
        </div>
      </section>

      {/* BATTLE WINNER BANNER */}
      {topLiked && (
        <section className="max-w-6xl mx-auto mb-8 md:mb-16 px-2">
          <div className="bg-gradient-to-r from-cyan-950/80 to-transparent p-4 md:p-10 border-l-4 md:border-l-8 border-cyan-400 rounded-r-2xl md:rounded-r-[3rem] card-glow flex items-center gap-4 md:gap-10 shadow-2xl">
            <span className="text-4xl md:text-7xl animate-bounce">🏆</span>
            <div>
              <h2 className="text-cyan-400 font-black text-[8px] md:text-xs tracking-[0.3em] mb-1 uppercase opacity-60">Battle Leader</h2>
              <p className="text-lg md:text-5xl font-black italic tracking-tighter truncate max-w-[150px] md:max-w-none">"{topLiked.name}" <span className="text-cyan-500/20 font-normal ml-2">— {topLiked.likes} ❤️</span></p>
            </div>
          </div>
        </section>
      )}

      {/* FEED */}
      <section className="max-w-6xl mx-auto pb-20 md:pb-40 px-2">
        <h2 className="text-xl md:text-2xl font-black mb-6 md:mb-10 text-pink-500 italic flex items-center gap-2 md:gap-3">
            <span className="w-2 h-6 md:h-8 bg-pink-500 rounded-sm"></span> BATTLE FEED
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {feed.map((nft) => (
            <div key={nft.nft_id} className="card-glow bg-gray-900/40 rounded-2xl md:rounded-3xl overflow-hidden group border border-white/5 flex flex-col hover:border-cyan-500/30 transition-all">
              <div className="aspect-square md:aspect-[4/5] overflow-hidden relative">
                <img src={nft.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="p-3 md:p-4 bg-gray-950/80 backdrop-blur-sm">
                <h3 className="text-[10px] md:text-xs font-black truncate mb-2 md:mb-3 uppercase tracking-tighter">{nft.name}</h3>
                <div className="flex gap-1.5 md:gap-2">
                  <button onClick={() => handleLike(nft.nft_id)} className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all ${likedNfts.includes(nft.nft_id) ? 'bg-gray-800 text-gray-500' : 'bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-white'}`}>
                    ❤️ {nft.likes}
                  </button>
                  <button onClick={() => setSelectedNft(nft)} className="flex-1 bg-cyan-600/10 text-cyan-400 py-2 rounded-lg md:rounded-xl text-[9px] font-black uppercase border border-cyan-500/20 hover:bg-cyan-600 hover:text-black active:scale-95 transition-all">Comment</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL */}
      {selectedNft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl transition-all">
          <div className="bg-[#050810] w-full max-w-4xl max-h-[90vh] rounded-[2rem] md:rounded-[2.5rem] flex flex-col md:flex-row border border-cyan-500/20 card-glow relative shadow-2xl overflow-hidden">
            <button onClick={() => setSelectedNft(null)} className="absolute top-4 md:top-6 right-4 md:right-6 z-10 bg-black/50 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all">✕</button>
            <div className="md:w-1/2 h-56 md:h-auto bg-black flex items-center justify-center flex-shrink-0">
              <img src={selectedNft.image_url} className="w-full h-full object-contain" />
            </div>
            <div className="md:w-1/2 p-5 md:p-8 flex flex-col overflow-y-auto custom-scroll no-scrollbar">
              <h2 className="text-2xl md:text-3xl font-black text-cyan-400 italic mb-1 uppercase tracking-tighter truncate">{selectedNft.name}</h2>
              <p className="text-[9px] md:text-[10px] text-gray-600 mb-4 md:mb-8 font-mono truncate">ID: {selectedNft.nft_id}</p>
              <div className="flex-grow space-y-2 md:space-y-3 mb-4 md:mb-6">
                <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3 md:mb-4">Activity Log</p>
                {feed.find(n => n.nft_id === selectedNft.nft_id)?.nft_comments?.map((c: any, i: number) => (
                  <div key={i} className="bg-white/5 p-2.5 md:p-3 rounded-xl md:rounded-2xl border border-white/5 text-[10px] md:text-[11px] text-gray-400">
                    <span className="text-cyan-500 mr-2">●</span> {c.comment_text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 bg-gray-800/50 p-1.5 rounded-xl md:rounded-2xl border border-white/5 focus-within:border-cyan-500/50 transition-all flex-shrink-0">
                <input className="flex-1 bg-transparent px-3 text-xs outline-none" placeholder="Add a comment..." value={modalComment} onChange={(e) => setModalComment(e.target.value)} />
                <button onClick={handleAddComment} className="bg-cyan-600 text-black px-4 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:bg-cyan-400 transition-all active:scale-95">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scroll::-webkit-scrollbar { display: block; width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(6,182,212,0.3); border-radius: 10px; }
      `}</style>
    </div>
  );
}

export default App;