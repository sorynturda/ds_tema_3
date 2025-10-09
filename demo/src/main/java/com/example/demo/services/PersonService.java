package com.example.demo.services;


import com.example.demo.dtos.PersonDTO;
import com.example.demo.dtos.PersonDetailsDTO;
import com.example.demo.dtos.builders.PersonBuilder;
import com.example.demo.entities.Person;
import com.example.demo.handlers.exceptions.model.ResourceNotFoundException;
import com.example.demo.repositories.PersonRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PersonService {
    private static final Logger LOGGER = LoggerFactory.getLogger(PersonService.class);
    private final PersonRepository personRepository;

    @Autowired
    public PersonService(PersonRepository personRepository) {
        this.personRepository = personRepository;
    }

    public List<PersonDTO> findPersons() {
        List<Person> personList = personRepository.findAll();
        return personList.stream()
                .map(PersonBuilder::toPersonDTO)
                .collect(Collectors.toList());
    }

    public PersonDetailsDTO findPersonById(UUID id) {
        Optional<Person> prosumerOptional = personRepository.findById(id);
        if (prosumerOptional.isEmpty()) {
            LOGGER.error("Person with id {} was not found in db", id);
            throw new ResourceNotFoundException(Person.class.getSimpleName() + " with id: " + id);
        }
        return PersonBuilder.toPersonDetailsDTO(prosumerOptional.get());
    }

    public UUID insert(PersonDetailsDTO personDTO) {
        Person person = PersonBuilder.toEntity(personDTO);
        person = personRepository.save(person);
        LOGGER.debug("Person with id {} was inserted in db", person.getId());
        return person.getId();
    }
    public PersonDetailsDTO update(PersonDetailsDTO personDTO) {
        Optional<Person> personOptional = personRepository.findById(personDTO.getId());
        if (personOptional.isPresent()){
            Person person = personOptional.get();
            person.setAddress(personDTO.getAddress());
            person.setName(personDTO.getName());
            personRepository.save(person);
            LOGGER.debug("Person with id {} was updated in db", personOptional.get());
            return PersonBuilder.toPersonDetailsDTO(person);
        }
        else{
            LOGGER.debug("Person with id {} was inserted in db", personDTO.getId());
            return PersonBuilder.toPersonDetailsDTO(personRepository.save(PersonBuilder.toEntity(personDTO)));
        }
    }

    public boolean delete(UUID id){
        Optional <Person> personOptional = personRepository.findById(id);
        if(personOptional.isPresent()){
            personRepository.delete(personOptional.get());
            LOGGER.debug("Person with id {} was deleted from db", id);
            return true;
        }else {
            LOGGER.debug("Person with id {} was not deleted from db",id);
            return false;
        }
    }
}
