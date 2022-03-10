import React from "react";
import Head from "next/head";
import "bootstrap/dist/css/bootstrap.min.css";
import { WebBundlr } from "@bundlr-network/client";
import BigNumber from "bignumber.js";
import {
  createIcon,
  Input,
  HStack,
  List,
  ListItem,
  ListIcon,
  Heading,
  Text,
  Button,
  VStack,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tooltip,
  Box,
  Container,
  Link,
  SimpleGrid,
  Stack,
  Flex,
  Image,
  Tag,
  useColorModeValue,
  StackDivider,
  Icon,
  IconButton,
  MenuDivider,
  useDisclosure,
} from "@chakra-ui/react";
import {
  IoAnalyticsSharp,
  IoLogoBitcoin,
  IoSearchSharp,
} from "react-icons/io5";
import { ReactNode, ReactElement } from "react";
import { HamburgerIcon, CloseIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { FaCheckCircle } from "react-icons/fa";

import WalletConnectProvider from "@walletconnect/web3-provider";
import { providers } from "ethers";
import { Web3Provider } from "@ethersproject/providers";
//import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom"
import * as nearAPI from "near-api-js";
import { WalletConnection } from "near-api-js";
import UploadModal from "./components/UploadModal";

const { keyStores, connect } = nearAPI;

declare var window: any; // TODO: specifically extend type to valid injected objects.
const PhantomWalletAdapter =
  require("@solana/wallet-adapter-phantom/lib/cjs/index").PhantomWalletAdapter;

function App() {
  const defaultCurrency = "Select a Currency";
  const defaultSelection = "Select a Provider";
  const [currency, setCurrency] = React.useState<string>(defaultCurrency);
  const [address, setAddress] = React.useState<string>();
  const [selection, setSelection] = React.useState<string>(defaultSelection);
  const [balance, setBalance] = React.useState<string>();
  const [img, setImg] = React.useState<Buffer>();
  const [price, setPrice] = React.useState<BigNumber>();
  const [bundler, setBundler] = React.useState<WebBundlr>();
  const [bundlerHttpAddress, setBundlerAddress] = React.useState<string>(
    "https://node1.bundlr.network"
  );
  const [fundAmount, setFundingAmount] = React.useState<string>();
  const [withdrawAmount, setWithdrawAmount] = React.useState<string>();
  const [provider, setProvider] = React.useState<Web3Provider>();

  const toast = useToast();
  const intervalRef = React.useRef<number>();

  const clean = async () => {
    clearInterval(intervalRef.current);
    setBalance(undefined);
    setImg(undefined);
    setPrice(undefined);
    setBundler(undefined);
    setProvider(undefined);
    setAddress(undefined);
    setCurrency(defaultCurrency);
    setSelection(defaultSelection);
  };

  const handleFileClick = () => {
    var fileInputEl = document.createElement("input");
    fileInputEl.type = "file";
    fileInputEl.accept = "image/*";
    fileInputEl.style.display = "none";
    document.body.appendChild(fileInputEl);
    fileInputEl.addEventListener("input", function (e) {
      handleUpload(e as any);
      document.body.removeChild(fileInputEl);
    });
    fileInputEl.click();
  };

  const handleUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    let files = evt.target.files;
    let reader = new FileReader();
    if (files && files.length > 0) {
      reader.onload = function () {
        if (reader.result) {
          setImg(Buffer.from(reader.result as ArrayBuffer));
        }
      };
      reader.readAsArrayBuffer(files[0]);
    }
  };

  const handlePrice = async () => {
    if (img) {
      const price = await bundler?.utils.getPrice(
        currency as string,
        img.length
      );
      //@ts-ignore
      setPrice(price?.toString());
    }
  };

  const uploadFile = async () => {
    if (img) {
      await bundler?.uploader
        .upload(img, [{ name: "Content-Type", value: "image/png" }])
        .then((res) => {
          toast({
            status:
              res?.status === 200 || res?.status === 201 ? "success" : "error",
            title:
              res?.status === 200 || res?.status === 201
                ? "Successful!"
                : `Unsuccessful! ${res?.status}`,
            description: res?.data.id
              ? `https://arweave.net/${res.data.id}`
              : undefined,
            duration: 15000,
          });
        })
        .catch((e) => {
          toast({ status: "error", title: `Failed to upload - ${e}` });
        });
    }
  };

  const fund = async () => {
    if (bundler && fundAmount) {
      toast({ status: "info", title: "Funding...", duration: 15000 });
      const value = parseInput(fundAmount);
      if (!value) return;
      await bundler
        .fund(value)
        .then((res) => {
          toast({
            status: "success",
            title: `Funded ${res?.target}`,
            description: ` tx ID : ${res?.id}`,
            duration: 10000,
          });
        })
        .catch((e) => {
          toast({
            status: "error",
            title: `Failed to fund - ${e.data?.message || e.message}`,
          });
        });
    }
  };

  const withdraw = async () => {
    if (bundler && withdrawAmount) {
      toast({ status: "info", title: "Withdrawing..", duration: 15000 });
      const value = parseInput(withdrawAmount);
      if (!value) return;
      await bundler
        .withdrawBalance(value)
        .then((data) => {
          toast({
            status: "success",
            title: `Withdrawal successful - ${data.data?.tx_id}`,
            duration: 5000,
          });
        })
        .catch((err: any) => {
          toast({
            status: "error",
            title: "Withdrawal Unsuccessful!",
            description: err.message,
            duration: 5000,
          });
        });
    }
  };

  // field change event handlers

  const updateAddress = (evt: React.BaseSyntheticEvent) => {
    setBundlerAddress(evt.target.value);
  };

  const updateFundAmount = (evt: React.BaseSyntheticEvent) => {
    setFundingAmount(evt.target.value);
  };

  const updateWithdrawAmount = (evt: React.BaseSyntheticEvent) => {
    setWithdrawAmount(evt.target.value);
  };

  const connectWeb3 = async (connector: any) => {
    if (provider) {
      await clean();
    }
    const p = new providers.Web3Provider(connector);
    await p._ready();
    return p;
  };

  /**
   * Map of providers with initialisation code - c is the configuration object from currencyMap
   */
  const providerMap = {
    MetaMask: async (c: any) => {
      if (!window?.ethereum?.isMetaMask) return;
      await window.ethereum.enable();
      const provider = await connectWeb3(window.ethereum);
      const chainId = `0x${c.chainId.toString(16)}`;
      try {
        // additional logic for requesting a chain switch and conditional chain add.
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId,
                rpcUrls: c.rpcUrls,
                chainName: c.chainName,
              },
            ],
          });
        }
      }
      return provider;
    },
    WalletConnect: async (c: any) => {
      return await connectWeb3(await new WalletConnectProvider(c).enable());
    },
    Phantom: async (c: any) => {
      if (window.solana.isPhantom) {
        await window.solana.connect();
        const p = new PhantomWalletAdapter();
        await p.connect();
        return p;
      }
    },
    "wallet.near.org": async (c: any) => {
      const near = await connect(c);
      const wallet = new WalletConnection(near, "bundlr");
      if (!wallet.isSignedIn()) {
        toast({
          status: "info",
          title: "You are being redirected to authorize this application...",
        });
        window.setTimeout(() => {
          wallet.requestSignIn();
        }, 4000);
        // wallet.requestSignIn();
      } else if (
        !(await c.keyStore.getKey(wallet._networkId, wallet.getAccountId()))
      ) {
        toast({
          status: "warning",
          title:
            "Click 'Connect' to be redirected to authorize access key creation.",
        });
      }
      return wallet;
    },
  } as any;

  const ethProviders = ["MetaMask", "WalletConnect"];

  const currencyMap = {
    // solana: {
    //   providers: ["Phantom"],
    //   opts: {},
    // },
    matic: {
      providers: ethProviders,
      opts: {
        chainId: 137,
        chainName: "Polygon Mainnet",
        rpcUrls: ["https://polygon-rpc.com"],
      },
    },
    // arbitrum: {
    //   providers: ethProviders,
    //   opts: {
    //     chainName: "Arbitrum One",
    //     chainId: 42161,
    //     rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    //   },
    // },
    // bnb: {
    //   providers: ethProviders,
    //   opts: {
    //     chainName: "Binance Smart Chain",
    //     chainId: 56,
    //     rpcUrls: ["https://bsc-dataseed.binance.org/"],
    //   },
    // },
    // avalanche: {
    //   providers: ethProviders,
    //   opts: {
    //     chainName: "Avalanche Network",
    //     chainId: 43114,
    //     rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
    //   },
    // },
    // boba: {
    //   providers: ethProviders,
    //   opts: {
    //     chainName: "BOBA L2",
    //     chainId: 288,
    //     rpcUrls: ["https://mainnet.boba.network"],
    //   },
    // },
    // near: {
    //   providers: ["wallet.near.org"],
    //   opts: {
    //     networkId: "mainnet",
    //     keyStore: new keyStores.BrowserLocalStorageKeyStore(),
    //     nodeUrl: "https://rpc.mainnet.near.org",
    //     walletUrl: "https://wallet.mainnet.near.org",
    //     helperUrl: "https://helper.mainnet.near.org",
    //     explorerUrl: "https://explorer.mainnet.near.org",
    //   },
    // },
  } as any;

  /**
   * initialises the selected provider/currency
   * @param cname currency name
   * @param pname provider name
   * @returns
   */
  const initProvider = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (provider) {
      setProvider(undefined);
      setBundler(undefined);
      setAddress(undefined);
      return;
    }

    const pname = selection as string;
    const cname = currency as string;
    const p = providerMap[pname]; // get provider entry
    const c = currencyMap[cname];
    console.log(`loading: ${pname} for ${cname}`);
    const providerInstance = await p(c.opts).catch((e: Error) => {
      toast({
        status: "error",
        title: `Failed to load provider ${pname}`,
        duration: 10000,
      });
      console.log(e);
      return;
    });
    setProvider(providerInstance);
  };

  const initBundlr = async () => {
    const bundlr = new WebBundlr(bundlerHttpAddress, currency, provider);
    try {
      // Check for valid bundlr node
      await bundlr.utils.getBundlerAddress(currency);
    } catch {
      toast({
        status: "error",
        title: `Failed to connect to bundlr ${bundlerHttpAddress}`,
        duration: 10000,
      });
      return;
    }
    try {
      await bundlr.ready();
    } catch (err) {
      console.log(err);
    } //@ts-ignore
    if (!bundlr.address) {
      console.log("something went wrong");
    }
    toast({ status: "success", title: `Connected to ${bundlerHttpAddress}` });
    setAddress(bundlr?.address);
    setBundler(bundlr);
  };

  const toProperCase = (s: string) => {
    return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
  };
  const toggleRefresh = async () => {
    if (intervalRef) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(async () => {
      bundler
        ?.getLoadedBalance()
        .then((r) => {
          setBalance(r.toString());
        })
        .catch((_) => clearInterval(intervalRef.current));
    }, 5000);
  };
  const ListHeader = ({ children }: { children: ReactNode }) => {
    return (
      <Text fontWeight={"500"} fontSize={"lg"} mb={2}>
        {children}
      </Text>
    );
  };

  function PriceWrapper({ children }: { children: ReactNode }) {
    return (
      <Box
        mb={4}
        shadow="base"
        borderWidth="1px"
        alignSelf={{ base: "center", lg: "flex-start" }}
        borderColor={useColorModeValue("gray.200", "gray.500")}
        borderRadius={"xl"}
      >
        {children}
      </Box>
    );
  }
  // parse decimal input into atomic units
  const parseInput = (input: string | number) => {
    const conv = new BigNumber(input).multipliedBy(
      bundler!.currencyConfig.base[1]
    );
    if (conv.isLessThan(1)) {
      toast({ status: "error", title: `Value too small!` });
      return;
    }
    return conv;
  };
  interface FeatureProps {
    text: string;
    iconBg: string;
    icon?: ReactElement;
  }

  const Feature = ({ text, icon, iconBg }: FeatureProps) => {
    return (
      <Stack direction={"row"} align={"center"}>
        <Flex
          w={8}
          h={8}
          align={"center"}
          justify={"center"}
          rounded={"full"}
          bg={iconBg}
        >
          {icon}
        </Flex>
        <Text fontWeight={600}>{text}</Text>
      </Stack>
    );
  };
  const Arrow = createIcon({
    displayName: "Arrow",
    viewBox: "0 0 72 24",
    path: (
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0.600904 7.08166C0.764293 6.8879 1.01492 6.79004 1.26654 6.82177C2.83216 7.01918 5.20326 7.24581 7.54543 7.23964C9.92491 7.23338 12.1351 6.98464 13.4704 6.32142C13.84 6.13785 14.2885 6.28805 14.4722 6.65692C14.6559 7.02578 14.5052 7.47362 14.1356 7.6572C12.4625 8.48822 9.94063 8.72541 7.54852 8.7317C5.67514 8.73663 3.79547 8.5985 2.29921 8.44247C2.80955 9.59638 3.50943 10.6396 4.24665 11.7384C4.39435 11.9585 4.54354 12.1809 4.69301 12.4068C5.79543 14.0733 6.88128 15.8995 7.1179 18.2636C7.15893 18.6735 6.85928 19.0393 6.4486 19.0805C6.03792 19.1217 5.67174 18.8227 5.6307 18.4128C5.43271 16.4346 4.52957 14.868 3.4457 13.2296C3.3058 13.0181 3.16221 12.8046 3.01684 12.5885C2.05899 11.1646 1.02372 9.62564 0.457909 7.78069C0.383671 7.53862 0.437515 7.27541 0.600904 7.08166ZM5.52039 10.2248C5.77662 9.90161 6.24663 9.84687 6.57018 10.1025C16.4834 17.9344 29.9158 22.4064 42.0781 21.4773C54.1988 20.5514 65.0339 14.2748 69.9746 0.584299C70.1145 0.196597 70.5427 -0.0046455 70.931 0.134813C71.3193 0.274276 71.5206 0.70162 71.3807 1.08932C66.2105 15.4159 54.8056 22.0014 42.1913 22.965C29.6185 23.9254 15.8207 19.3142 5.64226 11.2727C5.31871 11.0171 5.26415 10.5479 5.52039 10.2248Z"
        fill="currentColor"
      />
    ),
  });
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <section className=" vh-100">
      <Box bg={useColorModeValue("gray.100", "gray.900")} px={4}>
        <Flex h={20} alignItems={"center"} justifyContent={"space-between"}>
          <IconButton
            size={"md"}
            icon={isOpen ? <CloseIcon /> : <HamburgerIcon />}
            aria-label={"Open Menu"}
            display={{ md: "none" }}
            onClick={isOpen ? onClose : onOpen}
          />
          <HStack spacing={4} alignItems={"center"}>
            <Image
              src="android-chrome-192x192.png"
              alt="Logo"
              boxSize="70px"
            ></Image>
            <Text as="b" fontSize="2xl" color="black">
              Perma Books
            </Text>
            <HStack
              as={"nav"}
              spacing={4}
              display={{ base: "none", md: "flex" }}
            >
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Home
              </Link>
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Features
              </Link>
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Pricing
              </Link>
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Contact
              </Link>
            </HStack>
          </HStack>
        </Flex>

        {isOpen ? (
          <Box pb={4} display={{ md: "none" }}>
            <Stack as={"nav"} spacing={4}>
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Home
              </Link>
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Features
              </Link>
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Pricing
              </Link>
              <Link px={2} py={1} rounded={"md"} href={"#"}>
                Contact
              </Link>
            </Stack>
          </Box>
        ) : null}
      </Box>

      <>
        <Head>
          <link
            href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap"
            rel="stylesheet"
          />
        </Head>

        <Container maxW={"3xl"}>
          <Stack
            as={Box}
            textAlign={"center"}
            spacing={{ base: 8, md: 14 }}
            py={{ base: 20, md: 36 }}
          >
            <Heading
              fontWeight={600}
              fontSize={{ base: "2xl", sm: "4xl", md: "6xl" }}
              lineHeight={"110%"}
            >
              Store Literature <br />
              <Text as={"span"} color={"red.400"}>
                on the PermaWeb
              </Text>
            </Heading>
            <Text color={"gray.500"}>
              Perma-books is a dApp that provides{" "}
              <strong>permanent decentralized archival solution</strong> for
              publications, compositions, and literature. This platform is a
              simple and effective way to store data forever on-chain without
              paying incentives on a regular basis!
            </Text>
            <Stack
              direction={"column"}
              spacing={3}
              align={"center"}
              alignSelf={"center"}
              position={"relative"}
            >
              <UploadModal>
                <Box pt={20}>
                  <VStack>
                    <HStack>
                      <Menu>
                        <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                          {toProperCase(currency)}
                        </MenuButton>
                        <MenuList>
                          {Object.keys(currencyMap).map((v) => {
                            return (
                              <MenuItem
                                key={v}
                                onClick={() => {
                                  clean();
                                  setCurrency(v);
                                }}
                              >
                                {toProperCase(v)}
                              </MenuItem>
                            ); // proper/title case
                          })}
                        </MenuList>
                      </Menu>
                      <Menu>
                        <MenuButton
                          disabled={currency === defaultCurrency}
                          as={Button}
                          rightIcon={<ChevronDownIcon />}
                        >
                          {selection}
                        </MenuButton>
                        <MenuList>
                          {Object.keys(providerMap).map((v) => {
                            return currencyMap[currency] &&
                              currencyMap[currency].providers.indexOf(v) !==
                                -1 ? (
                              <MenuItem key={v} onClick={() => setSelection(v)}>
                                {v}
                              </MenuItem>
                            ) : undefined;
                          })}
                        </MenuList>
                      </Menu>
                      <Button
                        disabled={
                          !(
                            selection !== defaultSelection &&
                            currency !== defaultCurrency &&
                            bundlerHttpAddress.length > 8
                          )
                        }
                        onClick={async () => await initProvider()}
                      >
                        {provider ? "Disconnect" : "Connect"}
                      </Button>
                    </HStack>
                    <Text>Connected Account: {address ?? "None"}</Text>
                    <HStack>
                      <Button
                        w={400}
                        disabled={!provider}
                        onClick={async () => await initBundlr()}
                      >
                        Connect to Bundlr
                      </Button>
                      <Input
                        color="grey"
                        value={bundlerHttpAddress}
                        onChange={updateAddress}
                        placeholder="Bundler Address"
                      />
                    </HStack>
                    {bundler && (
                      <>
                        <HStack>
                          <Button
                            onClick={async () => {
                              address &&
                                bundler!
                                  .getBalance(address)
                                  .then((res: BigNumber) => {
                                    setBalance(res.toString());
                                  });
                              await toggleRefresh();
                            }}
                          >
                            Get {toProperCase(currency)} Balance
                          </Button>
                          {balance && (
                            <Tooltip
                              label={`(${balance} ${bundler.currencyConfig.base[0]})`}
                            >
                              <Text>
                                {toProperCase(currency)} Balance:{" "}
                                {bundler.utils
                                  .unitConverter(balance)
                                  .toFixed(7, 2)
                                  .toString()}{" "}
                                {bundler.currencyConfig.ticker.toLowerCase()}
                              </Text>
                            </Tooltip>
                          )}
                        </HStack>
                        <HStack>
                          <Button w={200} onClick={fund}>
                            Fund Bundlr
                          </Button>
                          <Input
                            placeholder={`${toProperCase(currency)} Amount`}
                            value={fundAmount}
                            onChange={updateFundAmount}
                          />
                        </HStack>
                        <HStack>
                          <Button w={200} onClick={withdraw}>
                            Withdraw Balance
                          </Button>
                          <Input
                            placeholder={`${toProperCase(currency)} Amount`}
                            value={withdrawAmount}
                            onChange={updateWithdrawAmount}
                          />
                        </HStack>
                        <Button onClick={handleFileClick}>
                          Select file from Device
                        </Button>
                        {img && (
                          <>
                            <HStack>
                              <Button onClick={handlePrice}>Get Price</Button>
                              {price && (
                                <Text>{`Cost: ${bundler.utils
                                  .unitConverter(price)
                                  .toString()} ${bundler.currencyConfig.ticker.toLowerCase()} `}</Text>
                              )}
                            </HStack>
                            <Button onClick={uploadFile}>
                              Upload to Bundlr Network
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </VStack>
                </Box>
              </UploadModal>
            </Stack>
          </Stack>
        </Container>
      </>

      <Container id="feature" maxW={"5xl"} py={12}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
          <Stack spacing={4}>
            <Text
              textTransform={"uppercase"}
              color={"blue.400"}
              fontWeight={600}
              fontSize={"sm"}
              bg={useColorModeValue("blue.50", "blue.900")}
              p={2}
              alignSelf={"flex-start"}
              rounded={"md"}
            >
              Features
            </Text>
            <Heading>Decentralized Literature Archival made simple.</Heading>
            <Text color={"gray.500"} fontSize={"lg"}>
              Archive any file permanently in remote nodes and retrieve them
              instantly
            </Text>
            <Stack
              spacing={4}
              divider={
                <StackDivider
                  borderColor={useColorModeValue("gray.100", "gray.700")}
                />
              }
            >
              <Feature
                icon={
                  <Icon
                    as={IoAnalyticsSharp}
                    color={"yellow.500"}
                    w={5}
                    h={5}
                  />
                }
                iconBg={useColorModeValue("yellow.100", "yellow.900")}
                text={"Literature / Books"}
              />
              <Feature
                icon={
                  <Icon as={IoLogoBitcoin} color={"green.500"} w={5} h={5} />
                }
                iconBg={useColorModeValue("green.100", "green.900")}
                text={"Important Documents"}
              />
              <Feature
                icon={
                  <Icon as={IoSearchSharp} color={"purple.500"} w={5} h={5} />
                }
                iconBg={useColorModeValue("purple.100", "purple.900")}
                text={"Resource Materials"}
              />
            </Stack>
          </Stack>
          <Flex>
            <Image
              rounded={"md"}
              alt={"feature image"}
              src="giphy.gif"
              objectFit={"cover"}
            />
          </Flex>
        </SimpleGrid>
      </Container>

      <Container id="feature" maxW={"5xl"} py={12}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
          <Flex>
            <Image
              rounded={"md"}
              alt={"feature image"}
              src="giphy (1).gif"
              objectFit={"cover"}
            />
          </Flex>
          <Stack spacing={4}>
            <Text
              textTransform={"uppercase"}
              color={"blue.400"}
              fontWeight={600}
              fontSize={"sm"}
              bg={useColorModeValue("blue.50", "blue.900")}
              p={2}
              alignSelf={"flex-start"}
              rounded={"md"}
            >
              How to Use
            </Text>
            <Heading>Using Decentralized Literature Archive</Heading>
            <Text color={"gray.500"} fontSize={"lg"}>
              Perma-books provides a user-friendly UI experience to store data
              directly hassle-free. First, the user connects his polygon wallet
              to the website and then he connects his account to any one of the
              public bundlr networks. After connecting, One can easily upload
              any files from his computer and bundle them instantly once the
              transaction is signed. It may take a few minutes to deploy it on
              the chain. As soon as the files are deployed we receive the
              transaction ID, through which we can directly access the data via
              www.arweave.net/TX_ID
            </Text>
          </Stack>
        </SimpleGrid>
      </Container>

      <Box
        mt={10}
        id="contact"
        bg={useColorModeValue("gray.50", "gray.900")}
        color={useColorModeValue("gray.700", "gray.200")}
      >
        <Container as={Stack} maxW={"6xl"} py={10}>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={8}>
            {/* <Stack align={"flex-start"}>
              <ListHeader>Product</ListHeader>
              <Link href={"#"}>Overview</Link>
              <Stack direction={"row"} align={"center"} spacing={2}>
                <Link href={"#"}>Features</Link>
                <Tag
                  size={"sm"}
                  bg={useColorModeValue("green.300", "green.800")}
                  ml={2}
                  color={"white"}
                >
                  New
                </Tag>
              </Stack>
              <Link href={"#"}>Tutorials</Link>
              <Link href={"#"}>Pricing</Link>
              <Link href={"#"}>Releases</Link>
            </Stack>
            <Stack align={"flex-start"}>
              <ListHeader>Company</ListHeader>
              <Link href={"#"}>About Us</Link>
              <Link href={"#"}>Press</Link>
              <Link href={"#"}>Careers</Link>
              <Link href={"#"}>Contact Us</Link>
              <Link href={"#"}>Partners</Link>
            </Stack>
            <Stack align={"flex-start"}>
              <ListHeader>Legal</ListHeader>
              <Link href={"#"}>Cookies Policy</Link>
              <Link href={"#"}>Privacy Policy</Link>
              <Link href={"#"}>Terms of Service</Link>
              <Link href={"#"}>Law Enforcement</Link>
              <Link href={"#"}>Status</Link>
            </Stack>
            <Stack align={"flex-start"}>
              <ListHeader>Follow Us</ListHeader>
              <Link href={"#"}>Facebook</Link>
              <Link href={"#"}>Twitter</Link>
              <Link href={"#"}>Dribbble</Link>
              <Link href={"#"}>Instagram</Link>
              <Link href={"#"}>LinkedIn</Link>
            </Stack> */}
          </SimpleGrid>
        </Container>
        <Box py={10}>
          <Flex
            align={"center"}
            _before={{
              content: '""',
              borderBottom: "1px solid",
              borderColor: useColorModeValue("gray.200", "gray.700"),
              flexGrow: 1,
              mr: 8,
            }}
            _after={{
              content: '""',
              borderBottom: "1px solid",
              borderColor: useColorModeValue("gray.200", "gray.700"),
              flexGrow: 1,
              ml: 8,
            }}
          >
            <Image
              src="android-chrome-192x192.png"
              alt="Logo"
              boxSize="100px"
            ></Image>
          </Flex>
          <Text pt={6} fontSize={"sm"} textAlign={"center"}>
            © 2022 Perma Books. All rights reserved
          </Text>
        </Box>
      </Box>
    </section>
  );
}

export default App;
