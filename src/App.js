import { useEffect, useState } from "react";
import { ethers } from "ethers";

// Components
import Navigation from "./components/Navigation";
import Search from "./components/Search";
import Home from "./components/Home";

// ABIs
import RealEstate from "./abis/RealEstate.json";
import Escrow from "./abis/Escrow.json";

// Config
import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [escrow, setEscrow] = useState(null);

  const [account, setAccount] = useState(null);

  const [homes, setHomes] = useState([]);
  const [home, setHome] = useState({});
  const [toggle, setToggle] = useState(false);

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);
    const network = await provider.getNetwork();

    const realEstate = new ethers.Contract(
      config[network.chainId].realEstate.address,
      RealEstate,
      provider
    );
    const totalSupply = await realEstate.totalSupply();
    const homes = [];

    for (var i = 1; i <= totalSupply; i++) {
      const uri = await realEstate.tokenURI(i);
      try {
        // Fetch các tệp JSON dựa trên chỉ số 'i'
        const response = await fetch(
          `http://localhost:8080/ipfs/QmQVcpsjrA6cr1iJjZAodYwmPekYgbnXGo4DFubJiLc2EB/${i}.json`
        );

        if (response.ok) {
          const metadata = await response.json();
          homes.push(metadata);
        } else {
          console.error(`Failed to fetch ${i}.json`);
        }
      } catch (error) {
        console.error(`Error fetching ${i}.json:`, error);
      }
    }

    setHomes(homes);

    const escrow = new ethers.Contract(
      config[network.chainId].escrow.address,
      Escrow,
      provider
    );
    setEscrow(escrow);

    window.ethereum.on("accountsChanged", async () => {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = ethers.utils.getAddress(accounts[0]);
      setAccount(account);
    });
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  const togglePop = (home) => {
    setHome(home);
    toggle ? setToggle(false) : setToggle(true);
  };

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <Search />
      <div className="cards__section">
        <h3>Homes For You</h3>
        <hr />
        <div className="cards">
          {homes.length > 0 ? (
            homes.map((home, index) => (
              <div className="card" key={index} onClick={() => togglePop(home)}>
                <div className="card__image">
                  <img src={home.image || "default-image.jpg"} alt="Home" />
                </div>
                <div className="card__info">
                  <h4>
                    {home.attributes ? home.attributes[0].value : "N/A"} ETH
                  </h4>
                  <p>
                    <strong>
                      {home.attributes ? home.attributes[2].value : "N/A"}
                    </strong>{" "}
                    bds |
                    <strong>
                      {home.attributes ? home.attributes[3].value : "N/A"}
                    </strong>{" "}
                    ba |
                    <strong>
                      {home.attributes ? home.attributes[4].value : "N/A"}
                    </strong>{" "}
                    sqft
                  </p>
                  <p>{home.address || "No address"}</p>
                </div>
              </div>
            ))
          ) : (
            <p>No homes available</p>
          )}
        </div>
      </div>

      {toggle && (
        <Home
          home={home}
          provider={provider}
          account={account}
          escrow={escrow}
          togglePop={togglePop}
        />
      )}
    </div>
  );
}

export default App;
