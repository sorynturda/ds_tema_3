package com.example.demo.controllers;

import com.example.demo.dtos.PersonDTO;
import com.example.demo.dtos.PersonDetailsDTO;
import com.example.demo.services.PersonService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/people")
@Validated
public class PersonController {

    private final PersonService personService;

    public PersonController(PersonService personService) {
        this.personService = personService;
    }

    @GetMapping
    public ResponseEntity<List<PersonDTO>> getPeople() {
        return ResponseEntity.ok(personService.findPersons());
    }

    @PostMapping
    public ResponseEntity<Void> create(@Valid @RequestBody PersonDetailsDTO person) {
        UUID id = personService.insert(person);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(id)
                .toUri();
        return ResponseEntity.created(location).build(); // 201 + Location header
    }

    @GetMapping("/{id}")
    public ResponseEntity<PersonDetailsDTO> getPerson(@PathVariable UUID id) {
        return ResponseEntity.ok(personService.findPersonById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePerson(@PathVariable UUID id){
        boolean deleted = personService.delete(id);
        if (deleted)
            return ResponseEntity.status(204).build();
        else
            return ResponseEntity.status(404).build();
    }
    @PutMapping("/{id}")
    public ResponseEntity<PersonDetailsDTO> updatePerson(@Valid @RequestBody PersonDetailsDTO personDetailsDTO, @PathVariable UUID id) {
        PersonDetailsDTO personDTO = personService.update(personDetailsDTO);
        if (id.equals(personDTO.getId())){
            return ResponseEntity.status(204).body(personDTO);
        }
        else {
            URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(personDTO.getId())
                .toUri();
            return ResponseEntity.created(location).build();
        }
    }

}
