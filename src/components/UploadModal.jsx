import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Button,
} from "@chakra-ui/react";

import { useState } from "react";

export default function UploadModal(props) {
  const OverlayTwo = () => (
    <ModalOverlay
      bg="none"
      backdropFilter="auto"
      backdropInvert="80%"
      backdropBlur="2px"
    />
  );
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [overlay, setOverlay] = useState(<OverlayTwo />);

  return (
    <div className="container text-center mt-5">
      <Button
        style={{ borderRadius: "100px" }}
        className="p-5"
        onClick={() => {
          setOverlay(<OverlayTwo />);
          onOpen();
        }}
      >
        Start Uploading Now
      </Button>

      <Modal
        size="xl"
        isOpen={isOpen}
        onClose={onClose}
        isCentered
        motionPreset="scale"
      >
        {overlay}
        <ModalContent>
          <ModalHeader>Store Document to Arweave</ModalHeader>
          <ModalCloseButton />
          <ModalBody>{props.children}</ModalBody>

          <ModalFooter>
            <Button colorScheme="red" onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
