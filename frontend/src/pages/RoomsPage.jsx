import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Heading,
  Button,
  Table,
  Flex,
  Dialog,
  TextField,
  Text,
  Select,
  Card,
  Separator,
} from '@radix-ui/themes';

const RoomsPage = () => {
  const [rooms, setRooms] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [formData, setFormData] = useState({
    roomNumber: '',
    roomType: '',
    price: '',
    description: '',
    status: 'Available',
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value) => {
    setFormData((prev) => ({ ...prev, status: value }));
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setIsEditing(false);
      setCurrentRoom(null);
      setFormData({
        roomNumber: '',
        roomType: '',
        price: '',
        description: '',
        status: 'Available',
      });
    }
    setOpen(isOpen);
  };

  const handleAddClick = () => {
    setIsEditing(false);
    setFormData({
      roomNumber: '',
      roomType: '',
      price: '',
      description: '',
      status: 'Available',
    });
    setOpen(true);
  };

  const handleEditClick = (room) => {
    setIsEditing(true);
    setCurrentRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      price: room.price,
      description: room.description || '',
      status: room.status,
    });
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = isEditing
      ? `http://localhost:3001/api/rooms/${currentRoom.roomId}`
      : 'http://localhost:3001/api/rooms';
    const method = isEditing ? 'put' : 'post';

    try {
      await axios[method](url, formData);
      fetchRooms();
      handleOpenChange(false);
    } catch (error) {
      console.error('Error saving room:', error);
    }
  };

  const handleDelete = async (roomId) => {
    try {
      await axios.delete(`http://localhost:3001/api/rooms/${roomId}`);
      fetchRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
    }
  };

  return (
    <Box>
      <Flex justify="between" align="center" mb="5">
        <Heading>Rooms</Heading>
        <Button onClick={handleAddClick}>Add Room</Button>
      </Flex>

      <Separator my="4" size="4" />

      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Content style={{ maxWidth: 450 }}>
          <Dialog.Title>{isEditing ? 'Edit Room' : 'Add Room'}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {isEditing ? 'Edit the details of the room.' : 'Add a new room to the hotel.'}
          </Dialog.Description>

          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Room Number
                </Text>
                <TextField.Input
                  name="roomNumber"
                  value={formData.roomNumber}
                  onChange={handleInputChange}
                  placeholder="Enter room number"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Room Type
                </Text>
                <TextField.Input
                  name="roomType"
                  value={formData.roomType}
                  onChange={handleInputChange}
                  placeholder="e.g., Single, Double, Suite"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Price
                </Text>
                <TextField.Input
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="Enter price per night"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Description
                </Text>
                <TextField.Input
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter a short description"
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Status
                </Text>
                <Select.Root
                  name="status"
                  value={formData.status}
                  onValueChange={handleSelectChange}
                >
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Item value="Available">Available</Select.Item>
                    <Select.Item value="Occupied">Occupied</Select.Item>
                    <Select.Item value="Under Maintenance">Under Maintenance</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>
            </Flex>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit">Save</Button>
            </Flex>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <Card>
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Room Number</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Price</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {rooms.map((room) => (
              <Table.Row key={room.roomId}>
                <Table.RowHeaderCell>{room.roomNumber}</Table.RowHeaderCell>
                <Table.Cell>{room.roomType}</Table.Cell>
                <Table.Cell>${room.price}</Table.Cell>
                <Table.Cell>{room.status}</Table.Cell>
                <Table.Cell>
                  <Flex gap="3">
                    <Button size="1" onClick={() => handleEditClick(room)}>
                      Edit
                    </Button>
                    <Button
                      size="1"
                      color="red"
                      onClick={() => handleDelete(room.roomId)}
                    >
                      Delete
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </Box>
  );
};

export default RoomsPage;
